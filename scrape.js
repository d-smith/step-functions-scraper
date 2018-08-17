var aws  = require('aws-sdk');
var zlib = require('zlib');
var async = require('async');
var s3 = new aws.S3();

var EVENT_SOURCE_TO_TRACK = /states.amazonaws.com/;
var EVENT_NAME_TO_TRACK = /StartExecution/;

module.exports.handleS3Event = (event, context, callback) => {
    console.log("oh yeah... cloud trail records");

    var srcBucket = event.Records[0].s3.bucket.name;
    var srcKey = event.Records[0].s3.object.key;
   
    async.waterfall([
        function fetchLogFromS3(next){
            console.log('Fetching compressed log from S3...');
            s3.getObject({
               Bucket: srcBucket,
               Key: srcKey
            },
            next);
        },
        function uncompressLog(response, next){
            console.log("Uncompressing log...");
            zlib.gunzip(response.Body, next);
        },
        function publishNotifications(jsonBuffer, next) {
            console.log('Filtering log...');
            var json = jsonBuffer.toString();

            var records;
            try {
                records = JSON.parse(json);
            } catch (err) {
                next('Unable to parse CloudTrail JSON: ' + err);
                return;
            }

            if(records.Records == undefined) {
                console.log("Parsed json has no records");
                return;
            }

            var matchingRecords = records
                .Records
                .filter(function(record) {
                    return record.eventSource.match(EVENT_SOURCE_TO_TRACK)
                        && record.eventName.match(EVENT_NAME_TO_TRACK);
                });

            matchingRecords.forEach((r) => {
                console.log('StartExecution:');
                console.log(`  state machine arn: ${r.requestParameters.stateMachineArn}`);
                console.log(`  execution arn: ${r.responseElements.executionArn}`);
            });
        }
    ], function(err) {
        if(err) {
            console.error('Ding', err);
        } else {
            console.log('Good');
        }
    });
} 