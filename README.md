# s3-upload-streams

A thin and fast wrapper on the top [aws-sdk](https://www.npmjs.com/package/aws-sdk) S3 functionality. It gives you a cleaner way to stream and partition your data to S3 utilizing the full power of [nodejs stream. Readable](https://nodejs.org/api/stream.html#stream_readable_streams) and [JavaScript Promises](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise) for controlling your application flow. 

You can see some basic usage examples [here](https://github.com/elsix/s3-upload-streams-demo)

# Benefits
Using nodejs streams gives you a standard way of manipulating data streams. You can keep your memory footprint low by piping directly to S3Uplaoder using [PassThrough streams](https://nodejs.org/api/stream.html#stream_class_stream_passthrough). You can encrypt or compress data on the fly using standard [crypto](https://nodejs.org/api/crypto.html) and [zlib](https://nodejs.org/api/zlib.html) modules. 
For maximum flexibility you provide the Readable streams directly to the S3Uploader instance. That way you can pipe transform and handler errors in the good old fashion way and the stream throttling and synchronization for free. The only thing that you must not do is to add stream into flowing and object mode, because you can't read data blocks in that modes. But of course you can pipe that kind of streams to a PassThrough stream and will get the synchronization for free again. That means you can't call `stream.resume()` and pass `objectMode=true` to the stream that you pass to S3Uploader instance. But you can make something like that `objectStream.pipe(passThroughStream)` and then pass passThroughStream to S3Uploader instance.  
# Installation
For now you can install this package directly from git hub using:

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

## constructor(s3, bucket, partSize, concurrency)
Initialize new S3Uploader.
### Params
**s3** - Instance of Amazon [aws-sdk s3](http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html)

**bucket** - Name of the bucket that you want to upload to. This can be overwritten per upload object using s3Params parameter of startUpload method.

**partSize** - The size of data chunk that will be read from the stream and will be passed to Amazon uploader. You can use this to optimize upload speed and memory usage. 

**concurrency** - Maximum number of concurrent Amazon uploads that can be done.
## s3Uploader.startUpload(s3Params, readable, additionalMetadata, partialUploadParams)
Initialize new object upload in this s3Uploader instance.
### Params
**s3Params** - Instance of [createMultipartUpload params](http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#createMultipartUpload-property) passed directly to Amazon. You can see the full list of parameters in Amazon's documentation.

**readable** - Instance of [nodes Readable, Duplex or Transform stream](https://nodejs.org/api/stream.html). Please be aware that the stream must be in [paused](https://nodejs.org/api/stream.html#stream_two_modes) and must not be in [object mode](https://nodejs.org/api/stream.html#stream_object_mode). Please see the Benefits section for more details.

**additionalMetadata** - Metadata that will be passed back to you when you complete the current upload.

**partialUploadParams** - Hash of additional parameters that you can pass if you want to manipulate partially uploaded object that is not initiated by this s3Uploader. Available params are:

*UploadId* - UploadId of already started [multipartUpload](http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#createMultipartUpload-property)

*Parts* - List of already uploaded parts of this object. The uploaded will use this list when it completes the upload. 
Please see Advanced Usage section for more information.
## s3Uploader.completeUpload(id)
Complete this object upload.
### Params
**id** - id of the current upload returned by startUpload method.
### Returns
Metadata a promise that resolves to uploaded object metadata. Available information is:

**location** - URL of this object.

**bucket** - The S3 Bucket.

**key** - The key in the S3.

**etag** - Entity tag of the object.

**additionalMetadata** - The metadata that you passed in startUpload.

**size** - Size in bytes.

## s3Uploader.abortUpload(id)
Abort this object upload.
### Params
**id** - id of the current upload returned by startUpload method.
### Returns
A promise that resolves to [abortMultipartUpload](http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#abortMultipartUpload-property) response.
## s3Uploader.complateAll()
Complete all uploads started by this s3-upload-streams instance.
### Returns
A promise that resolves to a list of all completed uploads metadata. See complateUpload documentation for more information.
## s3Uploader.abortAll()
Abort all uploads started by this s3-upload-streams instance.
### Returns
A promise that resolves to a list of all abortUpload responses.
# Advanced Usage
As s3-stream-uploader was designed to cover as many cases as possible we decided to add some methods for more complex cases in which you want to upload same S3Object using multiple processes and S3 up loaders.
## s3Uploader.awsUploadId(id)
Returns a promise that resolves to [aws-sdk s3 UploadId](http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#createMultipartUpload-property) which can be used to manipulate S3 object directly if you have to.
### Params
**id** - id of the current upload returned by startUpload method.
## s3Uploader.awsParts(id)
Returns a list of object parts that have been uploaded through this s3Uploader. You can see an example usage [here](https://github.com/elsix/s3-upload-streams-demo/blob/master/big-file-upload.js)
### Params
**id** - id of the current upload returned by startUpload method.
# Limitations
 * [S3 Multipart Upload](http://docs.aws.amazon.com/AmazonS3/latest/dev/mpuoverview.html) upload supports parts smaller than 5MB(5242880 Bytes) except for the last part of the object, so the minimal value of partSize parameter is 5242880.
 * Library is written using ES6 class syntax and I don't have plans to make a port for ES5.
