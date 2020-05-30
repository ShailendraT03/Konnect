const express = require('express')
const mysql = require('mysql')
const config = require('./config')
const hash = require('./encrypted')
const bodyparser = require('body-parser')
var app = express()

app.use(bodyparser.json())

app.post('/register',async function(req,res) {
	
    var user= {
        "type":req.body.type,
        "uname":req.body.uname,
        "email":req.body.email,
        "ph_no":req.body.phone_num,
		"password": req.body.password
    }
	if(user===undefined || user.type === undefined || user.uname === undefined || user.email === undefined || user.ph_no === undefined || user.password === undefined)
	{
		res.status(400).send("Bad Request");
    }
    
    res.status(200).send(JSON.stringify({Successful:"Successful"}));

})


app.post('/login', async function(req,res) {
    
	var user = {
		"uname" :req.body.uname,
		"type": req.body.type,
		"password":req.body.password
    }
    
	
	if(user.uname === undefined || user.type === undefined || user.password === undefined){
		res.status(401).send("Bad Credentials")
		return 1;
	}

	content = {
		uname: user.uname,
		type: user.type,
	}
	console.log(content);
	res.writeHead(200, {
         'Content-Type': 'application/json',
         'Content-Length': JSON.stringify(content).length
         })
    res.end(JSON.stringify(content));

})

var server = app.listen(config.host.port,config.host.hostname,function(){
    console.log(`app listening at http://${config.host.hostname}:${config.host.port}`)

})
