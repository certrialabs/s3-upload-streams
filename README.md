# s3-upload-streams

s3-upload-streams provides a thin wrapper on top of [aws-sdk](https://www.npmjs.com/package/aws-sdk) that allows multiple concurrent uploads of [nodejs.stream.Readable](https://nodejs.org/api/stream.html#stream_readable_streams) streams to S3.

# Benefits

 * a standard way for manipulating data streams
 * an improved control flow using [promises](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)
 * multiple concurrent uploads
 * no prior knowledge of data size required

The uploader accepts a readable block stream as a parameter that enables the utlization of the full power of the streaming interface such as on-the-fly compression and encryption of data using the standard [crypto](https://nodejs.org/api/crypto.html) and [zlib](https://nodejs.org/api/zlib.html) modules. [Flow](https://nodejs.org/api/stream.html#stream_two_modes) and [object](https://nodejs.org/api/stream.html#stream_object_mode) mode are not supported, however, piping to a PassThrough stream provides a nice workaround. For example:

```
objectStream.pipe(passThroughStream)
```

# Installation

`npm i --save s3-upload-streams`

# Basic Usage
```
  let Uploader = require('s3-upload-streams');
  let someFilePath = 'foo.txt';
  let s3Uploader = new Uploader(s3, bucket, partSize, maxConcurentUploads);
  let stream = fs.createReadStream(someFilePath);
  let uploadIdPromise = s3Uploader.startUpload({ Key: 'Amazon S3 Object Key' }, stream, { orginalPath: someFilePath });

  stream.on('end', () => {
    uploadIdPromise
    .then(uploadId => s3Uploader.completeUpload(uploadId))
    .then((metadata) => {
      console.log(`Uploaded ${metadata.additionalMetadata.orginalPath} to ${metadata.location}`);
      currentUploads = currentUploads - 1;
      tryNext();
    })
    .catch(err => console.log(err));
  });
```

See more example code [here](https://github.com/elsix/s3-upload-streams-demo)

## constructor
Initialize new S3Uploader.

### Params

**s3** - An instance of an Amazon [aws-sdk S3](http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html) object.

**bucket** - Name of the default S3 bucket for the specific S3 uploader. Can be overwritten by using the s3Params parameter of the startUpload method.

**partSize** - The size of the data chunk that will be read from the stream and will be passed to the Amazon uploader. Use this to optimize upload speed and memory usage.

**concurrency** - Maximum number of concurrent Amazon uploads.

## s3Uploader.startUpload
Initialize new object upload in the specific s3Uploader instance.

### Params
**s3Params** - An instance of [createMultipartUpload params](http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#createMultipartUpload-property) passed directly to Amazon. See the full list of parameters in Amazon's documentation.

**readable** - An instance of [nodes Readable, Duplex or Transform stream](https://nodejs.org/api/stream.html). Be aware that the stream must be [paused](https://nodejs.org/api/stream.html#stream_two_modes) and not in [object mode](https://nodejs.org/api/stream.html#stream_object_mode). 

**additionalMetadata** - Metadata that will be passed back to the caller when the current upload is complete.

**partialUploadParams** - A key-value set of parameters for manipulation of partially uploaded objects not initiated by this s3Uploader. Available parameters are:

*UploadId* - UploadId of an already started [multipartUpload](http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#createMultipartUpload-property)

*Parts* - List of already uploaded parts of this object. The uploader will use this list when it completes the upload. See Advanced Usage section for more information.

## s3Uploader.completeUpload(id)
Complete the current object upload.

### Params
**id** - id of the current upload returned by startUpload method.

### Returns
A promise that resolves to uploaded object metadata. Available information is:

**location** - URL of this object.

**bucket** - The S3 Bucket.

**key** - The key in the S3.

**etag** - Entity tag of the object.

**additionalMetadata** - The metadata passed in startUpload.

**size** - Size in bytes.

## s3Uploader.abortUpload(id)
Abort the current object upload.

### Params
**id** - id of the current upload returned by startUpload method.

### Returns
A promise that resolves to [abortMultipartUpload](http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#abortMultipartUpload-property) response.

## s3Uploader.complateAll()
Complete all uploads started by this s3-upload-streams instance.

### Returns
A promise that resolves to a list of all completed uploads metadata. See completeUpload documentation for more information.

## s3Uploader.abortAll()
Abort all uploads started by this s3-upload-streams instance.

### Returns
A promise that resolves to a list of all abortUpload responses.

# Advanced Usage

The following methods are designed in the case when a single S3Object is uploaded by multiple uploaders.

## s3Uploader.awsUploadId(id)
Returns a promise that resolves to [aws-sdk s3 UploadId](http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#createMultipartUpload-property) which can be used to manipulate S3 object directly if you have to.

### Params

**id** - id of the current upload returned by startUpload method.

## s3Uploader.awsParts(id)
Returns a list of object parts that have been uploaded through this s3Uploader. See an example usage [here](https://github.com/elsix/s3-upload-streams-demo/blob/master/big-file-upload.js)

### Params

**id** - id of the current upload returned by startUpload method.

# Limitations
 * [S3 Multipart Upload](http://docs.aws.amazon.com/AmazonS3/latest/dev/mpuoverview.html) upload supports parts smaller than 5MB(5242880 Bytes) except for the last part of the object, so the minimal value of partSize parameter is 5242880.
 * The library is written using ES6 class syntax and I don't have plans to port it in ES5.
