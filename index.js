/**
 * author: lrh
 * date:2019-03-25
 * description:定时采集高德路况数据并存入mongodb
 */
const mongo = require('mongodb')
const qs = require('querystring')
const fetch = require('node-fetch')
const schedule = require('node-schedule');
const fnv = require('fnv-plus');
const log4js = require('./log/log');
const log = log4js.logger("trafficService");

const url = 'mongodb://localhost:27017/gztraffic';
const dbname = 'gztraffic';
const collectionName = 'guangzhou';
const roadCollectionName = 'roads';
//查询参数
const param = {
    key: '7ed01d58934b7db5c57810e347278e90',
    level: 5,
    rectangle: '113.2618,23.1017;113.3093,23.114614',
    extensions: 'all'

};
//查询边界
var rect = [113.24226, 23.042285, 113.429027, 23.254509];

//定时任务
let scheduleTask = function () {
    schedule.scheduleJob('0 0,10,20,30,40,50 * * * *', function () {
        console.log('scheduleJob:' + new Date());
        getTraffic(1);
        getTraffic(2);
        getTraffic(3);
        getTraffic(4);
        getTraffic(5);
    });
}

/**
 * 将边界分割成网格
 */
let sliceGrid = function () {
    var rects = [];
    var xCount = 3;
    var yCount = 4;
    var dx = (rect[2] - rect[0]) / xCount;
    var dy = (rect[3] - rect[1]) / yCount;
    for (var i = 0; i < xCount; i++) {
        for (var j = 0; j < yCount; j++) {
            var sw = [rect[0] + i * dx, rect[1] + j * dy];
            var ne = [sw[0] + dx, sw[1] + dy];
            rects.push(sw[0] + ',' + sw[1] + ';' + ne[0] + ',' + ne[1]);
        }
    }
    return rects;
}
//test
let getRoadTraffic = function () {
    log.info("fatch road traffic");
    let param = { key: '54afb5246dec70a205533d8ea037569c', name: '岑村立交桥', city: '广州市', level: 2 }
    fetch('https://restapi.amap.com/v3/traffic/status/road?' + qs.stringify(param))
        .then(res => res.json())
        .then(json => {
            if (json.status === '1') {
                let trafficinfo = json.trafficinfo;
                trafficinfo.time = new Date();
                trafficinfo.level = level;
                insertDb(trafficinfo);
            }
        });
}

//查询路况信息
let getTraffic = function (level) {
    log.info("get road traffic");
    var rects = sliceGrid();
    let date = new Date();
    for (var i = 0; i < rects.length; i++) {
        param.level = level;
        param.rectangle = rects[i];
        fetch('http://restapi.amap.com/v3/traffic/status/rectangle?' + qs.stringify(param))
            .then(res => res.json())
            .then(json => {
                if (json.status === '1') {
                    let trafficinfo = json.trafficinfo;
                    trafficinfo.time = date;
                    trafficinfo.level = level;
                    insertDb(trafficinfo);
                }
            });
    }
}

/**
 * 创建数据库
 */
let createDb = function () {
    var MongoClient = require('mongodb').MongoClient;
    MongoClient.connect(url, function (err, db) {
        if (err) throw err;
        console.log('数据库已创建');
        var dbase = db.db(dbname);
        dbase.createCollection(collectionName, function (err, res) {
            if (err) throw err;
            console.log("创建集合!");
            db.close();
        });
        dbase.createCollection(roadCollectionName, function (err, res) {
            if (err) throw err;
            console.log("创建集合!");
            db.close();
        });
    });
}

/**
 * 插入数据
 * @param {} data 
 */
let insertDb = function (data) {
    var MongoClient = mongo.MongoClient;
    MongoClient.connect(url, function (err, db) {
        if (err) throw err;
        var dbo = db.db(dbname);

        //插入道路
        if (data.roads) {
            for (var i in data.roads) {
                var road = data.roads[i];
                var key = road.name + road.direction;
                var id = fnv.hash(key, 64).str();
                var distance = getDistance(splitPolyline(road.polyline))
                var insertRoad = {
                    _id: id,
                    key: key,
                    lcodes: road.lcodes,
                    polyline: road.polyline,
                    distance: distance
                }
                road.key = road.name + road.direction;
                road._id = fnv.hash(road.key, 64).str();
                road.distance = distance;
                dbo.collection(roadCollectionName).save(insertRoad).then(res => {
                });
                road.polyline = { $ref: roadCollectionName, $id: id }

            }
        }
        //插入路况
        dbo.collection(collectionName).insertOne(data, function (err, res) {
            if (err) throw err;
            console.log('insert success');
            db.close();
        });

    });
}
/**
 * 分割经纬度信息
 * @param {分号分隔的经纬度信息} str 
 * @returns {Array} 经纬度数组
 */
let splitPolyline = (str) => {
    var polyline = [];
    if (str) {
        var points = str.split(';');
        points.forEach(point => {
            var p = point.split(',');
            polyline.push([parseFloat(p[0]), parseFloat(p[1])]);
        });
    }
    return polyline;
}

/**
 * 计算线路长度
 * @param {Array} polyline 
 * @returns {Float32} 距离
 */
let getDistance = (polyline) => {
    var earthR = 6371.393;
    var distance = 0;
    if (polyline && polyline.length > 1) {
        var startPoint = polyline[0];
        for (var i = 1; i < polyline.length; i++) {
            distance += CalculateDistance(startPoint, polyline[i]);
            startPoint = polyline[i];
        }
    }
    return distance;
}

/**
 * 计算弧度
 * @param {*} num 
 */
function _Radian(num) {
    return num * Math.PI / 180;
}

/**
 * 计算两点间距离
 * @param {lnglat} point1 
 * @param {lnglat} point2 
 */
function CalculateDistance(point1, point2) {
    var earthR = 6371393;//地球半径 （米）
    var WA, WB;
    WA = _Radian(point1[1]);
    WB = _Radian(point2[1]);

    var lngMinus = Math.abs(point2[0] - point1[0]) > 180 ? 360 - Math.abs(point2[0] - point1[0]) : Math.abs(point2[0] - point1[0]);
    var lngRadian = _Radian(lngMinus);
    var ANGLE = Math.sin(WA) * Math.sin(WB) + Math.cos(WA) * Math.cos(WB) * Math.cos(lngRadian);
    var L = Math.acos(ANGLE) * earthR;
    return L;
}
//开始任务
scheduleTask();