'use strict';

let EventEmitter = require('events');
let uuid = require('uuid');
let  _    = require('lodash');


class Uploader extends EventEmitter {
  constructor(s3, bucket, partSize, concurency) {
    super();
    this.s3 = s3;
    this.concurency = concurency;
    this.bucket = bucket;
    this.partSize = partSize;
    this.uploadInternalStorage = {};
    this.readableUploads = {};

    this.activeRequestsCount = 0;
    this.on('_newDataAvailable', (uploadId) => {
      this.readableUploads[uploadId] = 1;
      // Try to upload newally available part
      this.emit('_tryUploadPart');
    });

    // You can use this event to visualize some kind of progress bar
    this.on('partUploaded', (uploadId) => { //eslint-disable-line no-unused-vars
      this.emit('_tryUploadPart');
    });

    this.on('_tryUploadPart', () => {
      // Randomly select next part to upload
      if (Object.keys(this.readableUploads).length > 0) {
        this.tryUploadPart(_.sample(Object.keys(this.readableUploads)));
      }
    });
  };

  startUpload(s3Params, readable, additionalMetadata, partialUploadParams) {
    let id = uuid.v4();
    if (! s3Params.hasOwnProperty('Key') ) {
      return new Promise ((resolve, reject) => reject('Please provide S3 Key'));
    }

    if (partialUploadParams &&
      (!partialUploadParams.hasOwnProperty('UploadId'))) {
        return new Promise((resolve, reject) => reject('Please provide UploadId for partial upload'));
    }

    let parts = [];
    let offset = 0;
    if (partialUploadParams && partialUploadParams.Parts) {
      parts = _.map(partialUploadParams.Parts, part => new Promise(resolve => resolve(part)));
    }

    if (partialUploadParams && partialUploadParams.Offset) {
      offset = partialUploadParams.Offset;
    }

    this.uploadInternalStorage[id] = {
      partPromises: parts,
      createUploadPromise: null,
      amazonKey: s3Params.Key,
      readable: readable,
      additionalMetadata: additionalMetadata,
      partOffset: offset
    };

    if (this.uploadInternalStorage[id].readable) {
      this.uploadInternalStorage[id].readable.on('readable', () => {
        this.emit('_newDataAvailable', id);
      });
    }

    // craeteMultipartUpload only if we are responsible to corrdinate all paralel uploads
    if (partialUploadParams) {
        this.uploadInternalStorage[id].createUploadPromise = new Promise((resolve) => resolve(partialUploadParams.UploadId));
    } else {
      this.uploadInternalStorage[id].createUploadPromise = this.s3.createMultipartUpload(_.merge({
          Bucket: this.bucket
        }, s3Params))
        .promise()
        .then((response) => response.UploadId);
    }

    return new Promise(resolve => resolve(id));
  }

  awsUploadId(id) {
    return this.uploadInternalStorage[id].createUploadPromise;
  }

  awsParts(id) {
    return Promise.all(this.uploadInternalStorage[id].partPromises);
  }

  completeUpload(uploadId) {
    return Promise.all(
      [this.uploadInternalStorage[uploadId].createUploadPromise].concat(this.uploadInternalStorage[uploadId].partPromises)
    )
    .then((requests) => {
      let key = this.uploadInternalStorage[uploadId].amazonKey;
      let amazonUploadId = requests[0];
      let parts = _.sortBy(requests.slice(1, requests.length), ['PartNumber']);
      return this.s3.completeMultipartUpload({
        Bucket: this.bucket,
        Key: key,
        UploadId: amazonUploadId,
        MultipartUpload: {
          Parts: parts
        }
      })
      .promise()
      .then((response) => {
        return this.s3.headObject({
          Bucket: response.Bucket,
          Key: response.Key
        })
        .promise()
        .then((metadata) => {
          let res = {
            location: response.Location,
            bucket: response.Bucket,
            key: response.Key,
            etag: response.Etag,
            additionalMetadata: this.uploadInternalStorage[uploadId].additionalMetadata,
            size: metadata.ContentLength
          };
          delete this.uploadInternalStorage[uploadId];
          return res;
        });
      });
    });
  }

  abortUpload(uploadId) {
    return Promise.all(
      [this.uploadInternalStorage[uploadId].createUploadPromise].concat(this.uploadInternalStorage[uploadId].partPromises)
    )
    .then((requests) => {
      let key = this.uploadInternalStorage[uploadId].amazonKey;
      let amazonUploadId = requests[0];
      let parts = requests.slice(1, requests.length);
      return this.s3.abortMultipartUpload({
        Bucket: this.bucket,
        Key: key,
        UploadId: amazonUploadId,
        MultipartUpload: {
          Parts: parts
        }
      })
      .promise()
      .then((response) => {
        delete this.uploadInternalStorage[uploadId];
        return response;
      });
    });
  }

  complateAll() {
    let complated = _.map(Object.keys(this.uploadInternalStorage), (id) => this.completeUpload(id));
    return Promise.all(complated);
  }

  abortAll() {
    let aborted = _.map(Object.keys(this.uploadInternalStorage), (id) => this.completeUpload(id));
    return Promise.all(aborted);
  }

  //Private Methods Section
  tryUploadPart(uploadId) {
    // Data should be false only after unsuccessful read.
    // That way we are sure that stream is not readable at the moment and we can remove it from readableUploads
    let data = true;
    let upload = this.uploadInternalStorage[uploadId];
    while(
      this.activeRequestsCount <= this.concurency &&
      null !== (data = upload.readable.read(this.partSize))
    ) {
      let dataCopy = data;
      this.activeRequestsCount++;
      let partNumber = this.uploadInternalStorage[uploadId].partOffset + this.uploadInternalStorage[uploadId].partPromises.length + 1;
      let amazonKey = this.uploadInternalStorage[uploadId].amazonKey;
      this.uploadInternalStorage[uploadId].partPromises.push(
        this.uploadInternalStorage[uploadId].createUploadPromise.
        then((uploadId) => {
          return this.s3.uploadPart({
            Bucket: this.bucket,
            Key: amazonKey,
            PartNumber: partNumber,
            UploadId: uploadId,
            Body: dataCopy
          })
          .promise();
        })
        .then((data) => {
          this.activeRequestsCount--;
          this.emit('partUploaded', uploadId);
          return { ETag: data.ETag, PartNumber: partNumber };
        })
      );
    };

    // Stream is not readable any more
    if (!data) {
      delete this.readableUploads[uploadId];
    }
  };
};

module.exports = Uploader;
