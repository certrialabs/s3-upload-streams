# s3-upload-streams

A thin and fast wrapper on the top [aws-sdk](https://www.npmjs.com/package/aws-sdk) S3 functionality. It gives you a cleaner way to stream and partition your data to S3 utilizing the full power of [nodejs stream.Readable](https://nodejs.org/api/stream.html#stream_readable_streams) and [javascript Promises](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise) for controling your application flow. 

You can see some basic usage examples [here](https://github.com/elsix/s3-upload-streams-demo)

# Benefits
Using nodejs streams gives you a standart way of manipulating data streams. You can keep your memory footprint low by piping directly to S3Uplaoder using [PassThrough streams](https://nodejs.org/api/stream.html#stream_class_stream_passthrough). You can encrypt or compress data on the fly using standart [crypto](https://nodejs.org/api/crypto.html) and [zlib](https://nodejs.org/api/zlib.html) modules. 
For maximum flexibility you provide the Readable streams directly to the S3Uploader instance. That way you can pipe transform and handler errors in the good old fashion way and the stream throtelling and synchronization for free. The only thing that you must not do is to add stream into flowing and object mode, because you can't read data blocks in that modes. But of cource you can pipe that kind of streams to a PassThrough stream and will get the synchronization for free again. That means you can't call `stream.resume()` and pass `objectMode=true` to the stream that you pass to S3Uploader instance. But you can make something like that `objectStream.pipe(passThroughStream)` and then pass passThroughStream to S3Uploader instance.  

# Intalation
For now you can install this package directly from github using:

`npm install --save https://github.com/elsix/s3-upload-streams#c08cad8cc59c3d28dc9a0e44e843b530674dd5e5`

I will publish a package with proper version to npm soon.

# Usage
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

## constructor(s3, bucket, partSize, concurency)
**s3** - Instance of amazon [aws-sdk s3](http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html)

**bucket** - Name of the bucket that you want to upload to

**partSize** - The size of data chunk that will be read from the stream and will be passed to amazon uploader. You can use this to optimze upload speed and memory usage. 

**concurency** - Maximum number of concurent amazon uploads that can be done.
## s3Uploader.startUpload(s3Params, readable, additionalMetadata, partialUploadParams)
TODO
## s3Uploader.completeUpload(id)
Complate this object upload.

**id** - id of the current upload returned by startUpload method.
## s3Uploader.abortUpload(id)
Abort this object upload.

**id** - id of the current upload returned by startUpload method.
## s3Uploader.complateAll()
Complate all uploads started by this s3-upload-streams instance.
## s3Uploader.abortAll()
Abort all uploads started by this s3-upload-streams instance.
## s3Uploader.awsUploadId(id)

**id** - id of the current upload returned by startUpload method.
## s3Uploader.awsParts(id)
**id** - id of the current upload returned by startUpload method.
# Limitations
 * [S3 Multipart Upload](http://docs.aws.amazon.com/AmazonS3/latest/dev/mpuoverview.html) upload supports parts smaller than 5MB(5242880 Bytes) except for the last part of the object, so the minimal value of partSize parameter is 5242880.
 * Library is writen using ES6 class syntax and I don't have plans to make a port for ES5.
