'use strict';

const aws = require('aws-sdk'),
    Promise = require('bluebird'),
    request = require('request'),
    list = require('./list'),
    rp = require('request-promise'),
    fs = require('fs'),
    bunyan = require('bunyan');

aws.config.setPromisesDependency(Promise);

const account = process.env.account,
    LAMBDA_NAME = "device-info",
    DEFAULT_LOG_LEVEL = "INFO",
    self = exports;

const log = bunyan.createLogger({
    name: LAMBDA_NAME,
    level: process.env.loglevel ? process.env.loglevel : DEFAULT_LOG_LEVEL,
    message: {}
});

exports.setResponse = function (b, code) {
    return {
        headers: {"Content-Type": "application/json"},
        statusCode: code,
        body: JSON.stringify(b)
    };
}

function writeToFile(jsonArray) {
    fs.appendFile("./device.json", JSON.stringify(jsonArray, null, 2), (err) => {
        if (err) {
            console.error(err);
            return;
        }
        console.log("File has been created"); //TODO: Use bunyan log
    });
}

function writeToFileArray(filename, jsonArray) {
    fs.writeFile(filename, JSON.stringify(jsonArray, null, 2), null, 2, (err) => {
        if (err) {
            console.error(err);
            return;
        }
        console.log("File has been created");
    });
}

function getDevice(inputValue) {
    let device = inputValue;
    let options = {
        uri: 'https://fonoapi.freshpixl.com/v1/getdevice', //TODO: Move to env.json
        headers: {},
        qs: {
            token: '762dcb182f3db2aed1a8e285ad6eda95238693bfe0068ab3', //TODO: Move to env.json
            device: device
        },
        json: true
    };
    return rp(options)
        .then(d => {
            console.log(d);
            writeToFile(d);
        });
}

function removeDuplicateFromArray(array) {
    return array.filter(function (elem, index, self) {
        return index == self.indexOf(elem);
    });
}

function splitArray(input, spacing) {
    let output = [];
    for (let i = 0; i < input.length; i += spacing) {
        output[output.length] = input.slice(i, i + spacing);
    }
    return output;
}

function resolveDevice(inputData) {
    let marketingName = '';
    let deviceArray = [];
    for (let i = 0; i < inputData.length; i++) {
        marketingName = (String(inputData[i].MarketingName)).toString();
        marketingName = marketingName.trim();
        if (marketingName && marketingName != '') {
            deviceArray.push(marketingName);
        }
    }
    let uniqueDevices = removeDuplicateFromArray(deviceArray);
    let splittedArray = splitArray(uniqueDevices, 90);
    for (let element in splittedArray) {
        for (let number in splittedArray[element]) {
            return Promise.resolve(getDevice(splittedArray[element][number]));
        }
    }
}

exports.handle = (ev, ctx, cb) => {
    log.debug({event: ev}, '---- incoming event');
    resolveDevice(list)
        .then(d => {
            log.debug({d: d}, '---- back to main method');
            cb(null, d);
        })
        .catch(e => {
            log.error({error: e.stack}, '----- error');
            cb(null, self.setResponse(e, 500));
        });
}
