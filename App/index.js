const express = require('express')
const mysql = require('mysql')
const creds = require('./database_auth_mod')
const config = require('./config')
const hash = require('./encrypted')
const bodyparser = require('body-parser')

var app = express()

app.use(bodyparser.json());


sql = {
    host	: creds.sqlhost,
    user	: creds.sqluser,
	password: creds.sqlpass,
	port	: 3308,
    database: 'K2GServices'
}

app.get('/',async function(req,res){
	res.status(200).send(JSON.stringify({Successful:"Successful"}));
})

app.post('/register',async function(req,res) {
	
    /* var user= {
		uname:req.body.uname,
		type:req.body.type,
        email:req.body.email,
        phone_num:req.body.phone_num,
		password: req.body.password
	} */
	
	user={}
	user.uname=req.body.uname
	user.type=req.body.type
	user.email=req.body.email
	user.phone_num=req.body.phone_num
	user.pass=req.body.pass

	console.log(user)

	if(user===undefined || user.type === undefined || user.uname === undefined || user.email === undefined || user.phone_num === undefined || user.pass === undefined)
	{
		res.status(400).send("Bad Request");
    }
    
    async function setUserDetails(user){
        return new Promise(function(resolve, reject) {
            connection = mysql.createConnection(sql);
            connection.query(`insert into KG_${user.type} (uname,email,phone_num) values ("${user.uname}","${user.email}",${user.phone_num})`,(err,result) => {
                if(err){
                    console.error(err);
                    resolve(undefined);
                }
                resolve(result)
            })
            connection.end()
        });
    }
    
    insertDetails = await setUserDetails(user);
    
    if (insertDetails === undefined){
		res.status(409).send("Username or E-Mail or phone number already exists")
		return 1;
    }

    async function getDetails(user){
        return new Promise(function(resolve, reject) {
            connection = mysql.createConnection(sql);
            connection.query(`select * from KG_${user.type} where uname = "${user.uname}"`,(err,result) => {
                resolve(result)
            })
            connection.end()
        });
    }
    async function setUserPassword(user){
        return new Promise(async function(resolve, reject) {
            userDetails = await getDetails(user)
			console.log(userDetails);
			if(user.type == "customer")
			{
				uid = userDetails[0].customer_id;
			}
			else if(user.type == "vendor")
			{
				uid = userDetails[0].vendor_id;
			}
            connection = mysql.createConnection(sql);
            connection.query(`insert into KG_passwords values (${uid},"${user.type}","${user.pass}",0)`,(err,result) => {
                if(err){
                    console.error(err);
                    resolve(undefined);
                }
                resolve(result)
            })
            connection.end()
        });
    }
    
    insertPassword = await setUserPassword(user);
    
	if(insertPassword === undefined){
		res.status(500).send("Error occured");
		return 2;
	}
    res.status(200).send(JSON.stringify({Successful:"Successful"}));

})


app.post('/login',async function(req,res) {
	
	/* var user = {
		uname :req.body.uname,
		type: req.body.type,
		password:req.body.password
	} */
	user={}
	user.uname=req.body.uname
	user.type=req.body.type
	user.pass=req.body.pass
	
	if(user.uname === undefined || user.type === undefined || user.pass === undefined){
		res.status(401).send("Bad Credentials")
		return 1;
	}

	async function get_id(uname){
		return new Promise(function(resolve, reject) {
			connection = mysql.createConnection(sql);
			connection.query(`select * from KG_${user.type} where uname = "${uname}" or email = "${uname}"`,(err,result) => {
				if(user.type == "customer")
				{
					if(err){
						console.error(err);
						resolve(undefined);
					}
					else if(result === undefined ||  result[0] === undefined || result[0].customer_id === undefined){
						resolve(undefined);
					}
					else {
						resolve(result[0].customer_id);
						console.log(result[0].customer_id);
					}
				}	

				else if(user.type == "vendor")
				{
					if(err){
						console.error(err);
						resolve(undefined);
					}
					else if(result === undefined ||  result[0] === undefined || result[0].vendor_id === undefined){
						resolve(undefined);
					}
					else {
						resolve(result[0].vendor_id);
						console.log(result[0].vendor_id);
					}
				}	
			})
			connection.end()
		});
	}
	

	user.id = await get_id(user.uname);
	if (user.id === undefined ){
		res.status(401).send("Bad Credentials")
		return 1;
	}

	async function getDetails(id){
		return new Promise(function(resolve, reject) {
			connection = mysql.createConnection(sql);
			connection.query(`select ${user.type}_id,uname,email,phone_num from KG_${user.type} where ${user.type}_id = "${id}"`,(err,result) => {
				resolve(result)
			})
			connection.end()
		});
	}
	
	reg_user = await getDetails(user.id);
	if (reg_user == undefined || reg_user.length <1 || reg_user[0]== undefined){
		res.status(403).end('reg_user not registered')
		return 0;
	}

	async function getpass(uid,type){
		return new Promise(function(resolve, reject) {
			connection = mysql.createConnection(sql);
			connection.query(`select password from KG_passwords where userid = ${uid} and usertype = "${type}"`,(err,result) => {
				resolve(result)
			})
			connection.end()
		});
	}
	reg_user = reg_user[0]
	if(user.type == "customer")
	{
		storedpass=await getpass(reg_user.customer_id,user.type)
		reg_user.id=reg_user.customer_id
	}
	else if(user.type == "vendor")
	{
		storedpass=await getpass(reg_user.vendor_id,user.type)
		reg_user.id=reg_user.vendor_id
	}
	
	if (user.pass != storedpass[0].password){
		res.status(401).end('Wrong Credentials<br>')
		return 0;
	}
	
	
	content = {
		id: reg_user.id,
		uname: reg_user.uname,
		email: reg_user.email,
		phone_num: reg_user.phone_num
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
