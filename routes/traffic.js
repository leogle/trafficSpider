const express = require('express');
const router = express.Router();
const mongo = require('mongodb');
const log4js = require('../log/log');
const log = log4js.logger("trafficService");
const moment = require('moment');
const url = 'mongodb://127.0.0.1:27017/gztraffic';
const dbname = 'gztraffic';
const collectionName = 'guangzhou';
const roadCollectionName = 'roads';

router.get('/gettraffic',function(req,res){
    try{
    log.info("gettraffic");
    var startTime = new Date(req.query.startTime);
    var endTime = new Date(req.query.endTime);
    var level = req.query.level;

    connectDb().then(dbo=>{
        dbo.collection(collectionName).find({'time':{$gte:startTime,$lte:endTime}}).toArray(
            function(err,result){
                writeHead(res);
                var roadStatus = [];
                result.forEach(record=>{
                    record.time = moment(record.time).format('YYYY-MM-DD HH:mm:ss')
                    record.roads.forEach(road=>{
                        
                        roadStatus.push({
                            name:road.name,
                            status:road.status,
                            speed:road.speed,
                            longName:road.key,
                            roadId:road._id,
                        })
                    })
                })
                return res.end(JSON.stringify(result));
            }
        )
    });
}catch(e){
    console.error(e);
}
});

router.get('/allroad', function (req, res) {
    try {
        log.info("get all road");
        console.log('get all road');
        console.log(moment().format('YYYY-MM-DD HH:mm:ss SSS'));
        var MongoClient = mongo.MongoClient;
        MongoClient.connect(url, function (err, db) {
            console.log('connected'+moment().format('YYYY-MM-DD HH:mm:ss SSS'));
            if (err) throw err;
            var dbo = db.db(dbname);
            var allroad = dbo.collection(roadCollectionName).find().toArray(function(err,result){
                if(err)
                    throw err;
                db.close();
                console.log(moment().format('YYYY-MM-DD HH:mm:ss SSS'));
                res.writeHead(200, {
                    'Content-Type': 'application/javascript;charset=utf-8',
                    "Access-Control-Allow-Origin": "*",
                    "Cache-Control":"no-transform",
                    "Expires":moment().add(7,'days').toDate().toUTCString()
                });
                return res.end(JSON.stringify(result));
            });


        });
    } catch (e) {
        log.error("get all road error" + e.toString());
        throw e;
    }
});


const connectDb = function(){
    return new Promise((resolve,reject)=>{
        var MongoClient = mongo.MongoClient;
        MongoClient.connect(url, function (err, db) {
            if (err) 
                reject(err);
            var dbo = db.db(dbname);
            resolve(dbo);
        });
    });
}

let writeHead = function (res) {
    res.writeHead(200, {
        'Content-Type': 'application/json;charset=utf-8',
        "Access-Control-Allow-Origin": "*"
    });
};
module.exports = router;
