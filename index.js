const express = require('express')
const mysql = require('mysql')
const creds = require('./database_auth_mod')
const config = require('./config')
const bodyparser = require('body-parser')
const cookieParser = require('cookie-parser')
const http = require('http')
const crypto = require('crypto')
const encrypted = require('./encrypted')
const nodemailer = require('nodemailer')
const mail_creds = require('./mail_creds')
const passport = require('passport')
const auth = require('./auth')
const smsclient = require('./smsClient')
const fileSystem=require('fs')
const moment = require('moment')
format="YYYY-MM-DD HH:mm:ss"
var port = config.port
var hostname = config.hostname
var app = express()

app.use(bodyparser.json());
app.use(passport.initialize());
app.use(cookieParser());

auth(passport);

var mail = nodemailer.createTransport({
	service: 'gmail',
	host: 'smtp.gmail.com',
	port: 465,
	auth: {
	  user: mail_creds.email.user,
	  pass: mail_creds.email.pass
	}
  });
 
sql = {
    host	: creds.sqlhost,
    user	: creds.sqluser,
	password: creds.sqlpass,
	port	: 3306,
	database: 'K2GServices',
	multipleStatements: true
}
var jmsg=""

app.get("/auth/facebook", passport.authenticate("facebook",{scope: ["email"]},'vendor'));
app.get('/auth/google', passport.authenticate('google', {scope: ['https://www.googleapis.com/auth/userinfo.profile','https://www.googleapis.com/auth/userinfo.email']}));
app.get("/auth/facebook/callback",passport.authenticate("facebook",{successRedirect:'/loginsuccess',failureRedirect:'/fail'}),async function(req,res){});
app.get('/auth/google/callback',passport.authenticate('google', {failureRedirect: '/fail',successRedirect: '/loginsuccess'}),async function(req, res){});
app.get("/fail", (req, res) => {res.send("Failed attempt");});
app.get("/loginsuccess", (req, res) => {res.send("Success");});

app.get('/',async function(req,res){res.status(200).send(JSON.stringify({message:"Successful"}));})

app.post('/register',async function(req,res) {
	
    user={}
	user.uname=req.body.uname
	user.type=req.body.type
	user.email=req.body.email
	user.phone_num=req.body.phone_num
	user.pass=req.body.pass

	console.log('/register',moment().format(format),user)

	if(user===undefined || user.type === undefined || user.uname === undefined || user.email === undefined || user.phone_num === undefined || user.pass === undefined)
	{
		res.status(400).send(JSON.stringify({message:"Bad Request"}));
		console.log("Bad Request")
		return 1;
    }
    
	if(user.type !== "customer" && user.type !== "vendor" && user.type !== "admin")
	{
		res.status(400).send(JSON.stringify({message:"Bad Request"}));
		console.log("Bad Request")
		return 1;
	}
	    
    async function setUserDetails(user){
        return new Promise(function(resolve, reject) {
			connection = mysql.createConnection(sql);
			var query=`insert into KG_user (uname,usertype,email,phone_num) values ("${user.uname}","${user.type}","${user.email}",${user.phone_num})`
            connection.query(query,(err,result) => {
                if(err){
					console.error(err);
					var rsv={}
                    rsv.er=err.sqlMessage
					resolve(rsv);
                }
                resolve(result)
            })
            connection.end()
        });
	}
	
	insertDetails = await setUserDetails(user);
    
    if (insertDetails.er !== undefined){
		var jmsg=""
		if(insertDetails.er.includes('Duplicate'))
		{
			if(insertDetails.er.includes('uname'))
			{
				jmsg="Username already exists"
			}
			if(insertDetails.er.includes('phone_num'))
			{
				jmsg="Phone number already exists"
			}
			if(insertDetails.er.includes('usertype'))
			{
				jmsg="Email already exists as this user type"
			}
			if(insertDetails.er.includes('usertype_2'))
			{
				jmsg="Phone number already exists as this user type"
			}
		}
		res.status(409).end(JSON.stringify({message:`${jmsg}`}))
		console.log(`${jmsg}`)
		return 1;
    }

    async function setUserPassword(user){
        return new Promise(async function(resolve, reject) {
            userDetails = await getDetails(user)
			console.log(userDetails);
			uid = userDetails[0].userid;
			hashSalt = encrypted.saltHashPassword(user.pass);
            connection = mysql.createConnection(sql);
            connection.query(`insert into KG_passwords values (${uid},"${hashSalt.passwordHash}","${hashSalt.salt}")`,(err,result) => {
                if(err){
					console.error(err);
					var rsv={}
                    rsv.er=err.sqlMessage
                    resolve(rsv);
                }
                resolve(result)
            })
            connection.end()
        });
    }
    
    insertPassword = await setUserPassword(user);
    
	if(insertPassword.er !== undefined){
		res.status(500).send(JSON.stringify({message:`${insertPassword.er}`}));
		console.log(`${insertPassword.er}`)
		return 2;
	}

	async function getDetails(user){
        return new Promise(function(resolve, reject) {
            connection = mysql.createConnection(sql);
            connection.query(`select * from KG_user where uname = "${user.uname}"`,(err,result) => {
                resolve(result)
            })
            connection.end()
        });
    }

	reg_user = await getDetails(user)
	reg_user=reg_user[0]
	content = {
        id: reg_user.userid,
        usertype:reg_user.usertype,
		uname: reg_user.uname,
		email: reg_user.email,
		phone_num: reg_user.phone_num,
		ver_email: reg_user.ver_email,
		ver_phno: reg_user.ver_phno
	}
	console.log(content);
	res.writeHead(200, {
         'Content-Type': 'application/json',
         'Content-Length': JSON.stringify(content).length
         })
    res.end(JSON.stringify(content));
})

app.post('/showuserdetail',async function(req,res){
	var user={}
	user.id=req.body.id

	console.log('/showuserdetail',moment().format(format),user)
	
	if(user===undefined || user.id === undefined)
	{
		res.status(400).send(JSON.stringify({message:"Bad Request"}));
		console.log("Bad Request")
		return 1;
    }

	async function checkUser(user){
        return new Promise(async function(resolve, reject) {
			connection = mysql.createConnection(sql);
            connection.query(`select * from KG_user where userid=${user.id}`,(err,result) => {
                if(err){
					console.error(err);
					var rsv={}
                    rsv.er=err.sqlMessage
                    resolve(rsv);
                }
                resolve(result)
            })
            connection.end()
        });
	}

	async function getUseraddress(user){
        return new Promise(async function(resolve, reject) {
			connection = mysql.createConnection(sql);
            connection.query(`select * from KG_user_address where userid=${user.id}`,(err,result) => {
                if(err){
					console.error(err);
					var rsv={}
                    rsv.er=err.sqlMessage
                    resolve(rsv);
                }
                resolve(result)
            })
            connection.end()
        });
	}

	chkuser = await checkUser(user)
	
	if(chkuser.length == 0)
	{
		res.status(500).send(JSON.stringify({message:"User not registered"}));
		console.log("User not registered")
		return 1;
	}

	guseraddress = await getUseraddress(user)

	if(guseraddress.length == 0)
	{
		console.log("Address not added")
	}

	chkuser=chkuser[0]
	guseraddress=guseraddress[0]
	
	content = {
		user_info: chkuser,
		user_address:guseraddress
	}
	console.log("content",content);
	res.writeHead(200, {
         'Content-Type': 'application/json',
         'Content-Length': JSON.stringify(content).length
         })
    res.end(JSON.stringify(content));
})

app.delete('/deleteuser',async function(req,res){
	user={}
	user.id=req.body.id
	console.log('/deleteuser',moment().format(format),user)

	if(user===undefined || user.id === undefined)
	{
		res.status(400).send(JSON.stringify({message:"Bad Request"}));
		console.log("Bad Request")
		return 1;
	}
	
	async function checkUser(user){
        return new Promise(async function(resolve, reject) {
			connection = mysql.createConnection(sql);
            connection.query(`select * from KG_user where userid=${user.id}`,(err,result) => {
                if(err){
					console.error(err);
					var rsv={}
                    rsv.er=err.sqlMessage
                    resolve(rsv);
                }
                resolve(result)
            })
            connection.end()
        });
	}

	async function deleteUser(user){
		return new Promise(function(resolve, reject) {
			connection = mysql.createConnection(sql);
			q1=`delete from KG_passwords where userid=${user.id};`
			q2=`delete from KG_user_address where userid=${user.id};`
			q3=`delete from KG_provided_services where vendor_id=${user.id};`
			q4=`delete from KG_required_services where customer_id=${user.id};`
			q5=`delete from KG_booked_services where vendor_id=${user.id} or customer_id=${user.id};`
			q6=`delete from KG_user where userid=${user.id};`
			connection.query(q1+q2+q3+q4+q5+q6,(err,result) => {
				if(err){
					console.error(err);
					var rsv={}
                    rsv.er=err.sqlMessage
                    resolve(rsv);
                }
				resolve(result)
			})
			connection.end()
		});
	}

	chkuser = await checkUser(user)
	console.log(chkuser)

	if(chkuser.length == 0)
	{
		res.status(500).send(JSON.stringify({message:"User not registered"}));
		console.log("User not registered")
		return 1;
	}
	
	dusr = await deleteUser(user)

	if(dusr.er !== undefined)
	{
		res.status(500).send(JSON.stringify({message:`${dusr.er}`}));
		console.log(`${dusr.er}`)
		return 3;
	}

	res.status(200).end(JSON.stringify({message:"User deletion successful"}));
	console.log("User deletion successful")
})

app.post('/login',async function(req,res) {
	
	user={}
	user.uname=req.body.uname
	user.type=req.body.type
	user.pass=req.body.pass

	console.log('/login',moment().format(format),user)
	
	if(user.uname === undefined || user.type === undefined || user.pass === undefined){
		res.status(401).send(JSON.stringify({message:"Bad Request"}))
		console.log("Bad Request")
		return 1;
	}

	async function get_id(user){
		return new Promise(function(resolve, reject) {
			connection = mysql.createConnection(sql);
			connection.query(`select * from KG_user where uname = "${user.uname}" or email = "${user.uname}" and usertype="${user.type}"`,(err,result) => {
			    if(err){
                    console.error(err);
                    resolve(undefined);
                }
                else if(result === undefined ||  result[0] === undefined || result[0].userid === undefined){
                    resolve(undefined);
                }
                else {
                    resolve(result[0].userid);
                }
			})
			connection.end()
		});
	}
	

	user.id = await get_id(user);

	if (user.id === undefined ){
		res.status(401).send(JSON.stringify({message:"Bad Credentials"}))
		console.log("Bad Credentials")
		return 1;
	}

	async function getDetails(id){
		return new Promise(function(resolve, reject) {
			connection = mysql.createConnection(sql);
			connection.query(`select userid,usertype,uname,email,phone_num,ver_email,ver_phno from KG_user where userid = "${id}"`,(err,result) => {
				resolve(result)
			})
			connection.end()
		});
	}
	
	reg_user = await getDetails(user.id);
	if (reg_user == undefined || reg_user.length <1 || reg_user[0]== undefined){
		res.status(403).end(JSON.stringify({message:'User not registered'}))
		console.log('User not registered')
		return 0;
	}

	async function getpass(uid){
		return new Promise(function(resolve, reject) {
			connection = mysql.createConnection(sql);
			connection.query(`select password,salt from KG_passwords where userid = ${uid}`,(err,result) => {
				resolve(result)
			})
			connection.end()
		});
	}
	reg_user = reg_user[0]
	storedpass=await getpass(reg_user.userid)
	reg_user.id=reg_user.userid
	storedpass=storedpass[0]
	var valid = encrypted.validPassword(user.pass,storedpass.password,storedpass.salt)
	if(!(valid))
	{
		res.status(401).end(JSON.stringify({message:'Wrong Credentials'}))
		console.log('Wrong Credentials')
		return 0;
	}
		
	content = {
        id: reg_user.id,
        usertype:reg_user.usertype,
		uname: reg_user.uname,
		email: reg_user.email,
		phone_num: reg_user.phone_num,
		ver_email: reg_user.ver_email,
		ver_phno: reg_user.ver_phno
	}
	console.log(content);
	res.writeHead(200, {
         'Content-Type': 'application/json',
         'Content-Length': JSON.stringify(content).length
         })
    res.end(JSON.stringify(content));

})

app.get('/getimage/:category',async function (req,res){
	img={}
	img.category=req.params.category

	console.log('/getimage',moment().format(format),img)

	if(img===undefined || img.category === undefined)
	{
		res.status(400).send(JSON.stringify({message:"Bad Request"}));
		console.log("Bad Request")
		return 1;
	}

	async function getImagePath(img){
		return new Promise(function(resolve, reject) {
			connection = mysql.createConnection(sql);
			connection.query(`select imgpath from KG_images where imgcategory="${img.category}"`,(err,result)=>{
				if(err){
					console.error(err);
					resolve(undefined);
					return 0;
				}
				else if(result.length<1){
					resolve(undefined);
					return 0;
				}
				resolve(result);
			})
			connection.end()
		});
	}

	imPaths = await getImagePath(img)

	if(imPaths == undefined){
		res.status(403).end(JSON.stringify({message:'No images available in this category'}))
		console.log('No images available in this category')
		return 0;
	}
	else
	{
		console.log(imPaths);
		contnt={}
		for(p=0;p<imPaths.length;p++)
		{
			//img = fileSystem.readFileSync(imPaths[p].imgpath);
			//console.log(img)
			imPaths[p].imgpath=imPaths[p].imgpath.replace(`${config.dirname}`+"/images_ui/",'')
			imPaths[p].imgpath=imPaths[p].imgpath.split('/').join('+')
			imPaths[p].imgpath=imPaths[p].imgpath.split(' ').join('*')
			contnt[`img${p+1}`]=`http://${hostname}:${port}/sendimage/${imPaths[p].imgpath}`
		}
	}
	console.log(contnt);
	res.writeHead(200, {
         'Content-Type': 'application/json',
         'Content-Length': JSON.stringify(contnt).length
         })
	res.end(JSON.stringify(content));
})

app.get('/sendimage/:path',async function(req,res){
	user={}
	user.path=req.params.path
	console.log('/sendimage',moment().format(format),user)

	if(user===undefined || user.path === undefined)
	{
		res.status(400).send(JSON.stringify({message:"Bad Request"}));
		console.log("Bad Request")
		return 1;
	}
	path=user.path.split('+').join('/')
	path=path.split('*').join(' ')
	path=config.dirname+"/images_ui/"+path
	console.log(path)
	res.sendFile(path)
})

app.post('/sendresetcode',async function(req,res){
	var user={}
	user.phone_num=req.body.phone_num
	user.appcode=req.body.appcode
	console.log('/sendresetcode',moment().format(format),user)

	if(user===undefined || user.phone_num === undefined || user.appcode === undefined)
	{
		res.status(400).send(JSON.stringify({message:"Bad Request"}));
		console.log("Bad Request")
		return 1;
    }

	user.code=Math.floor(1000 + Math.random() * 9000)
		
	async function checkPhonenum(user){
        return new Promise(async function(resolve, reject) {
			connection = mysql.createConnection(sql);
            connection.query(`select * from KG_user where phone_num="${user.phone_num}"`,(err,result) => {
                if(err){
					console.error(err);
					var rsv={}
                    rsv.er=err.sqlMessage
                    resolve(rsv);
                }
                resolve(result)
            })
            connection.end()
        });
	}

	async function setVerifycode(user){
        return new Promise(async function(resolve, reject) {
			connection = mysql.createConnection(sql);
            connection.query(`update KG_user set ver_code=${user.code} where phone_num="${user.phone_num}"`,(err,result) => {
                if(err){
					console.error(err);
					var rsv={}
                    rsv.er=err.sqlMessage
                    resolve(rsv);
                }
                resolve(result)
            })
            connection.end()
        });
	}
	
	chkpnum = await checkPhonenum(user)
	console.log(chkpnum)

	if(chkpnum.length == 0)
	{
		res.status(500).send(JSON.stringify({message:"Phone number not registered"}));
		console.log("Phone number not registered")
		return 1;
	}

	setvcode = await setVerifycode(user)

	if(setvcode.er !== undefined)
	{
		res.status(500).send(JSON.stringify({message:`${setvcode.er}`}));
		console.log(`${setvcode.er}`)
		return 2;
	}
	user.verifycode=user.code
	result = await smsclient.sendVmsg(user)
	console.log(result)

	if(result.status === "failure")
	{
		res.status(500).send(JSON.stringify({message:`${result.errors[0].message}`}));
		console.log(`${result.errors[0].message}`)
		return 3;
	}
	else if(result.status === "success")
	{
		console.log("Reset password code SMS sent successful")
		res.status(200).send(JSON.stringify({message:"Reset password code SMS sent successful"}));
	}
})

app.post('/verifyresetcode',async function(req,res){
	user={}
	user.phone_num=req.body.phone_num
	user.code=req.body.code

	console.log('/verifyresetcode',moment().format(format),user)

	if(user===undefined || user.phone_num === undefined || user.code === undefined)
	{
		res.status(400).send(JSON.stringify({message:"Bad Request"}));
		console.log("Bad Request")
		return 1;
    }

	async function setVerifycode(user){
        return new Promise(async function(resolve, reject) {
			var code=Math.floor(100000 + Math.random() * 900000)
			console.log('code',code)
			connection = mysql.createConnection(sql);
            connection.query(`update KG_user set ver_code=${code} where phone_num="${user.phone_num}"`,(err,result) => {
                if(err){
					console.error(err);
					var rsv={}
                    rsv.er=err.sqlMessage
                    resolve(rsv);
                }
                resolve(result)
            })
            connection.end()
        });
	}

	async function checkPhno(user){
        return new Promise(async function(resolve, reject) {
			connection = mysql.createConnection(sql);
            connection.query(`select ver_code from KG_user where phone_num="${user.phone_num}"`,(err,result) => {
                if(err){
					console.error(err);
					var rsv={}
                    rsv.er=err.sqlMessage
                    resolve(rsv);
                }
                resolve(result)
            })
            connection.end()
        });
	}

	async function setCodeverified(user){
        return new Promise(async function(resolve, reject) {
			connection = mysql.createConnection(sql);
            connection.query(`update KG_user set code_verified=1 where phone_num="${user.phone_num}"`,(err,result) => {
                if(err){
					console.error(err);
					var rsv={}
                    rsv.er=err.sqlMessage
                    resolve(rsv);
                }
                resolve(result)
            })
            connection.end()
        });
	}

	chkpno = await checkPhno(user)
	
	if(chkpno.length == 0)
	{
		res.status(500).send(JSON.stringify({message:"Phone number not registered"}));
		console.log("Phone number not registered")
		return 1;
	}
	chkpno = chkpno[0]
	
	if(user.code === chkpno.ver_code)
	{
		setcverified = await setCodeverified(user)
	
		if(setcverified.er !== undefined){
			res.status(500).send(JSON.stringify({message:`${setcverified.er}`}));
			console.log(`${setcverified.er}`)
			return 1;
		}
		else
		{
			setvcode = await setVerifycode(user)

			if(setvcode.er !== undefined)
			{
				res.status(500).send(JSON.stringify({message:`${setvcode.er}`}));
				console.log(`${setvcode.er}`)
				return 2;
			}
			console.log("code verified successful")
			res.status(200).send(JSON.stringify({message:"code verified successful"}));
		}
	}
	else
	{
		console.log("Incorrect code")
		res.status(401).end(JSON.stringify({message:"Incorrect code"}))
	}
})

app.post('/resetpasscode',async function(req,res){
	user={}
	user.phone_num=req.body.phone_num
	user.newpass=req.body.newpass

	console.log('/resetpasscode',moment().format(format),user)

	if(user===undefined || user.phone_num === undefined || user.newpass === undefined)
	{
		res.status(400).send(JSON.stringify({message:"Bad Request"}));
		console.log("Bad Request")
		return 1;
    }

	async function checkCodeverified(user){
        return new Promise(async function(resolve, reject) {
			connection = mysql.createConnection(sql);
            connection.query(`select code_verified from KG_user where phone_num="${user.phone_num}"`,(err,result) => {
                if(err){
					console.error(err);
					var rsv={}
                    rsv.er=err.sqlMessage
                    resolve(rsv);
                }
                resolve(result)
            })
            connection.end()
        });
	}

	chkcverified = await checkCodeverified(user)
	
	if(chkcverified.length == 0)
	{
		res.status(500).send(JSON.stringify({message:"Phone number not registered"}));
		console.log("Phone number not registered")
		return 1;
	}
	chkcverified = chkcverified[0]
	
	if(chkcverified.code_verified === 1)
	{
		console.log('code_verified',chkcverified.code_verified)
	}
	else
	{
		res.status(401).end(JSON.stringify({message:"code not verified"}))
		console.log("code not verified")
		return 1;
	}

	async function getUid(user){
        return new Promise(async function(resolve, reject) {
			connection = mysql.createConnection(sql);
            connection.query(`select userid from KG_user where phone_num="${user.phone_num}" and code_verified=1`,(err,result) => {
                if(err){
					console.error(err);
					var rsv={}
                    rsv.er=err.sqlMessage
                    resolve(rsv);
                }
                resolve(result)
            })
            connection.end()
        });
	}

	g_id = await getUid(user)
	if(g_id.er !== undefined){
		res.status(500).send(JSON.stringify({message:`${g_id.er}`}));
		console.log(`${g_id.er}`)
		return 1;
	}
	user.id = g_id[0].userid
	async function resetPass(user){
        return new Promise(async function(resolve, reject) {
			hashSalt = encrypted.saltHashPassword(user.newpass);
			connection = mysql.createConnection(sql);
            connection.query(`update KG_passwords set password="${hashSalt.passwordHash}",salt="${hashSalt.salt}" where userid=${user.id}`,(err,result) => {
                if(err){
					console.error(err);
					var rsv={}
                    rsv.er=err.sqlMessage
                    resolve(rsv);
                }
                resolve(result)
            })
            connection.end()
        });
	}
	
	async function setCodeverified(user){
        return new Promise(async function(resolve, reject) {
			hashSalt = encrypted.saltHashPassword(user.newpass);
			connection = mysql.createConnection(sql);
            connection.query(`update KG_user set code_verified=0 where phone_num="${user.phone_num}"`,(err,result) => {
                if(err){
					console.error(err);
					var rsv={}
                    rsv.er=err.sqlMessage
                    resolve(rsv);
                }
                resolve(result)
            })
            connection.end()
        });
	}

	
	rstpass = await resetPass(user)

	if(rstpass.er !== undefined)
	{
		res.status(500).send(JSON.stringify({message:`${rstpass.er}`}));
		console.log(`${rstpass.er}`)
		return 1;
	}
	else
	{
		res.status(200).send(JSON.stringify({message:"Password reset successful"}));
		console.log("Password reset successful")

		setcverified = await setCodeverified(user)
	
		if(setcverified.er !== undefined){
			res.status(500).send(JSON.stringify({message:`${setcverified.er}`}));
			console.log(`${setcverified.er}`)
			return 1;
		}
		else
		{
			res.status(200).end(JSON.stringify({message:"code verified set successful"}));
			console.log("code verified set successful")
		}
	}
})

app.post('/verifyemail',async function(req,res){
	var user={}
	user.email=req.body.email

	console.log('/verifyemail',moment().format(format),user)

	if(user===undefined || user.email === undefined)
	{
		res.status(400).send(JSON.stringify({message:"Bad Request"}));
		console.log("Bad Request")
		return 1;
	}
	
	var code=Math.floor(100000 + Math.random() * 900000)
	var secretcode=crypto.randomBytes(100).toString('hex').slice(0,100);
		
	async function checkEmail(user){
        return new Promise(async function(resolve, reject) {
			connection = mysql.createConnection(sql);
            connection.query(`select * from KG_user where email="${user.email}"`,(err,result) => {
                if(err){
					console.error(err);
					var rsv={}
                    rsv.er=err.sqlMessage
                    resolve(rsv);
                }
                resolve(result)
            })
            connection.end()
        });
	}

	async function setVerifycode(user,code){
        return new Promise(async function(resolve, reject) {
			connection = mysql.createConnection(sql);
            connection.query(`update KG_user set ver_code=${code},secret_code="${secretcode}" where email="${user.email}"`,(err,result) => {
                if(err){
					console.error(err);
					var rsv={}
                    rsv.er=err.sqlMessage
                    resolve(rsv);
                }
                resolve(result)
            })
            connection.end()
        });
	}
	
	chkemail = await checkEmail(user)

	if(chkemail.length == 0)
	{
		res.status(500).send(JSON.stringify({message:"Email not registered"}));
		console.log("Email not registered")
		return 1;
	}

	setvcode = await setVerifycode(user,code)

	if(setvcode.er !== undefined)
	{
		res.status(500).send(JSON.stringify({message:`${setvcode.er}`}));
		console.log(`${setvcode.er}`)
		return 2;
	}

	mailOptions = {
		from: "K2GServices",
		to: user.email,
		subject: "K2GService Email verfication",
		html: `<h4>Verification link:</h4> <a href="http://${hostname}:${port}/vlink/${secretcode}/${code}">Click here</a>`
	}
	
	mail.sendMail(mailOptions, function(error, info){
		if (error) {
		  console.error(error)
		  res.end(JSON.stringify({message:error}));
		  console.log(JSON.stringify(error));
		  return error;
		} else {
		  console.log('Email sent: ' + info.response);
		  res.end(JSON.stringify({message:'Email sent: ' + info.response}));
		  return info.response;
		}
	  });
})

app.get('/vlink/:secret/:code',async function(req,res){
	
	user={}
	user.secretcode=req.params.secret
	user.vcode=req.params.code*1

	console.log('/vlink',moment().format(format),user)

	async function setVerifyemail(user){
        return new Promise(async function(resolve, reject) {
			connection = mysql.createConnection(sql);
            connection.query(`update KG_user set ver_email=1 where secret_code="${user.secretcode}" and ver_code=${user.vcode}`,(err,result) => {
                if(err){
					console.error(err);
					var rsv={}
                    rsv.er=err.sqlMessage
                    resolve(rsv);
                }
                resolve(result)
            })
            connection.end()
        });
	}

	setvemail = await setVerifyemail(user)

	if(setvemail.er !== undefined)
	{
		res.status(500).send(JSON.stringify({message:`${setvemail.er}`}));
		console.log("not verified")
		return 1;
	}

	async function checkVeremail(user){
        return new Promise(async function(resolve, reject) {
			connection = mysql.createConnection(sql);
			console.log(`select ver_email from KG_user where secret_code="${user.secretcode}" and ver_code=${user.vcode}`)
            connection.query(`select ver_email from KG_user where secret_code="${user.secretcode}" and ver_code=${user.vcode}`,(err,result) => {
                if(err){
					console.error(err);
					var rsv={}
                    rsv.er=err.sqlMessage
                    resolve(rsv);
                }
                resolve(result)
            })
            connection.end()
        });
	}

	chkvemail = await checkVeremail(user)
	console.log(chkvemail)

	if(chkvemail.er !== undefined)
	{
		res.status(500).send(JSON.stringify({message:`${chkvemail.er}`}));
		console.log("not verified")
		return 2;
	}

	if(chkvemail.length == 0)
	{
		res.status(500).send(JSON.stringify({message:"Wrong code or secret"}));
		console.log("not verified")
		return 3;
	}
	chkvemail = chkvemail[0]
	if(chkvemail.ver_email == 1)
	{
		res.status(200).send(JSON.stringify({message:"Email verified"}));
		console.log("Email verified")
	}
	else
	{
	res.status(500).send(JSON.stringify({message:"Email not verified"}));
	console.log("Email not verified")
	}
})

app.post('/smscode',async function(req,res){
	var user={}
	user.phone_num=req.body.phone_num
	user.appcode=req.body.appcode
	console.log('/smscode',moment().format(format),user)

	if(user===undefined || user.phone_num === undefined || user.appcode === undefined)
	{
		res.status(400).send(JSON.stringify({message:"Bad Request"}));
		console.log("Bad Request")
		return 1;
    }

	user.verifycode=Math.floor(1000 + Math.random() * 9000)
		
	async function checkPhonenum(user){
        return new Promise(async function(resolve, reject) {
			connection = mysql.createConnection(sql);
            connection.query(`select * from KG_user where phone_num="${user.phone_num}"`,(err,result) => {
                if(err){
					console.error(err);
					var rsv={}
                    rsv.er=err.sqlMessage
                    resolve(rsv);
                }
                resolve(result)
            })
            connection.end()
        });
	}

	async function setVerifycode(user){
        return new Promise(async function(resolve, reject) {
			connection = mysql.createConnection(sql);
            connection.query(`update KG_user set ver_smscode=${user.verifycode} where phone_num="${user.phone_num}"`,(err,result) => {
                if(err){
					console.error(err);
					var rsv={}
                    rsv.er=err.sqlMessage
                    resolve(rsv);
                }
                resolve(result)
            })
            connection.end()
        });
	}
	
	chkpnum = await checkPhonenum(user)
	console.log(chkpnum)

	if(chkpnum.length == 0)
	{
		res.status(500).send(JSON.stringify({message:"Phone number not registered"}));
		console.log("Phone number not registered")
		return 1;
	}

	setvcode = await setVerifycode(user)

	if(setvcode.er !== undefined)
	{
		res.status(500).send(JSON.stringify({message:`${setvcode.er}`}));
		console.log(`${setvcode.er}`)
		return 2;
	}
	result = await smsclient.sendVmsg(user)
	console.log(result)

	if(result.status === "failure")
	{
		res.status(500).send(JSON.stringify({message:`${result.errors[0].message}`}));
		console.log(`${result.errors[0].message}`)
		return 3;
	}
	else if(result.status === "success")
	{
		console.log("Verification code SMS sent successful")
		res.status(200).send(JSON.stringify({message:"Verification code SMS sent successful"}));
	}
})

app.post('/verifysmscode',async function(req,res){
	user={}
	user.phone_num=req.body.phone_num
	user.code=req.body.code

	console.log('/verifysmscode',moment().format(format),user)

	if(user===undefined || user.phone_num === undefined || user.code === undefined)
	{
		res.status(400).send(JSON.stringify({message:"Bad Request"}));
		console.log("Bad Request")
		return 1;
    }

	async function setVerifycode(user){
        return new Promise(async function(resolve, reject) {
			var code=Math.floor(100000 + Math.random() * 900000)
			console.log('code',code)
			connection = mysql.createConnection(sql);
            connection.query(`update KG_user set ver_smscode=${code} where phone_num="${user.phone_num}"`,(err,result) => {
                if(err){
					console.error(err);
					var rsv={}
                    rsv.er=err.sqlMessage
                    resolve(rsv);
                }
                resolve(result)
            })
            connection.end()
        });
	}

	async function checkPhonenum(user){
        return new Promise(async function(resolve, reject) {
			connection = mysql.createConnection(sql);
            connection.query(`select ver_smscode from KG_user where phone_num="${user.phone_num}"`,(err,result) => {
                if(err){
					console.error(err);
					var rsv={}
                    rsv.er=err.sqlMessage
                    resolve(rsv);
                }
                resolve(result)
            })
            connection.end()
        });
	}

	async function setCodeverified(user){
        return new Promise(async function(resolve, reject) {
			connection = mysql.createConnection(sql);
            connection.query(`update KG_user set ver_phno=1 where phone_num="${user.phone_num}"`,(err,result) => {
                if(err){
					console.error(err);
					var rsv={}
                    rsv.er=err.sqlMessage
                    resolve(rsv);
                }
                resolve(result)
            })
            connection.end()
        });
	}

	chkpnum = await checkPhonenum(user)
	
	if(chkpnum.length == 0)
	{
		res.status(500).send(JSON.stringify({message:"Phone number not registered"}));
		console.log("Phone number not registered")
		return 1;
	}
	chkpnum = chkpnum[0]
	
	if(user.code === chkpnum.ver_smscode)
	{
		setcverified = await setCodeverified(user)
	
		if(setcverified.er !== undefined){
			res.status(500).send(JSON.stringify({message:`${setcverified.er}`}));
			console.log(`${setcverified.er}`)
			return 1;
		}
		else
		{
			setvcode = await setVerifycode(user)

			if(setvcode.er !== undefined)
			{
				res.status(500).send(JSON.stringify({message:`${setvcode.er}`}));
				console.log(`${setvcode.er}`)
				return 2;
			}
			console.log("Phone number verified successful")
			res.status(200).send(JSON.stringify({message:"Phone number verified successful"}));
		}
	}
	else
	{
		console.log("Incorrect code")
		res.status(401).end(JSON.stringify({message:"Incorrect code"}))
	}
})

app.post('/addaddress',async function(req,res){
	var user={}
	user.id=req.body.id
	user.pincode=req.body.pincode        
	user.country=req.body.country 
	user.region=req.body.region       
	user.district=req.body.district       
	user.locality=req.body.locality
    user.building_street=req.body.building_street  
    user.landmark=req.body.landmark

	console.log('/addaddress',moment().format(format),user)

	if(user===undefined || user.id === undefined || user.pincode === undefined || user.country === undefined || user.district === undefined || user.locality === undefined || user.building_street === undefined)
	{
		res.status(400).send(JSON.stringify({message:"Bad Request"}));
		console.log("Bad Request")
		return 1;
	}

	if(user.pincode <= 100000 || user.pincode >=1000000)
	{
		res.status(400).send(JSON.stringify({message:"Invalid pincode"}));
		console.log("Invalid pincode")
		return 1;
	}
	if(user.landmark === undefined)
	{
		user.landmark='null'
	}
	else
	{
		user.landmark='"'+user.landmark+'"'
	}

	async function checkUser(user){
        return new Promise(async function(resolve, reject) {
			connection = mysql.createConnection(sql);
            connection.query(`select * from KG_user where userid=${user.id}`,(err,result) => {
                if(err){
					console.error(err);
					var rsv={}
                    rsv.er=err.sqlMessage
                    resolve(rsv);
                }
                resolve(result)
            })
            connection.end()
        });
	}

	async function checkUseraddress(user){
        return new Promise(async function(resolve, reject) {
			connection = mysql.createConnection(sql);
            connection.query(`select * from KG_user_address where userid=${user.id}`,(err,result) => {
                if(err){
					console.error(err);
					var rsv={}
                    rsv.er=err.sqlMessage
                    resolve(rsv);
                }
                resolve(result)
            })
            connection.end()
        });
	}
	
	async function setAddress(user){
        return new Promise(async function(resolve, reject) {
			connection = mysql.createConnection(sql);
			query=`insert into KG_user_address (userid, pincode, country, region, district, locality, building_street, landmark) values (${user.id},${user.pincode},"${user.country}","${user.region}","${user.district}","${user.locality}","${user.building_street}",${user.landmark})`
			console.log(query)
			connection.query(query,(err,result) => {
                if(err){
					console.error(err);
					var rsv={}
                    rsv.er=err.sqlMessage
                    resolve(rsv);
                }
                resolve(result)
            })
            connection.end()
        });
	}

	async function updateAddress(user){
        return new Promise(async function(resolve, reject) {
			connection = mysql.createConnection(sql);
			query=`update KG_user_address set pincode=${user.pincode}, country="${user.country}", region="${user.region}", district="${user.district}", locality="${user.locality}", building_street="${user.building_street}", landmark=${user.landmark} where userid=${user.id}`
			console.log(query)
			connection.query(query,(err,result) => {
                if(err){
					console.error(err);
					var rsv={}
                    rsv.er=err.sqlMessage
                    resolve(rsv);
                }
                resolve(result)
            })
            connection.end()
        });
	}
	
	chkuser = await checkUser(user)

	if(chkuser.length == 0)
	{
		res.status(500).send(JSON.stringify({message:"User not registered"}));
		console.log("User not registered")
		return 1;
	}

	chkuaddress = await checkUseraddress(user)

	if(chkuaddress.length == 0)
	{
		setadrs = await setAddress(user)
		if(setadrs.er !== undefined)
		{
			res.status(500).send(JSON.stringify({message:`${setadrs.er}`}));
			console.log(`${setadrs.er}`)
			return 2;
		}
	}
	else
	{
		updadrs = await updateAddress(user)
		if(updadrs.er !== undefined)
		{
			res.status(500).send(JSON.stringify({message:`${updadrs.er}`}));
			console.log(`${updadrs.er}`)
			return 3;
		}
	}
	res.status(200).send(JSON.stringify({message:"User Address set Successful"}));
	console.log("User Address set Successful")
})

app.post('/showaddress',async function(req,res){
	user={}
	user.id=req.body.id

	console.log('/showaddress',moment().format(format),user)

	if(user===undefined || user.id === undefined)
	{
		res.status(400).send(JSON.stringify({message:"Bad Request"}));
		console.log("Bad Request")
		return 1;
	}

	async function getUseraddress(user){
        return new Promise(async function(resolve, reject) {
			connection = mysql.createConnection(sql);
            connection.query(`select * from KG_user_address where userid=${user.id}`,(err,result) => {
                if(err){
					console.error(err);
					var rsv={}
                    rsv.er=err.sqlMessage
                    resolve(rsv);
                }
                resolve(result)
            })
            connection.end()
        });
	}

	guseraddress = await getUseraddress(user)

	if(guseraddress.length == 0)
	{
		res.status(500).send(JSON.stringify({message:"Address not added"}));
		console.log("Address not added")
		return 1;
	}
	guseraddress=guseraddress[0]
	content = {
		address: guseraddress
	}
	console.log("Address",content);
	res.writeHead(200, {
         'Content-Type': 'application/json',
         'Content-Length': JSON.stringify(content).length
         })
    res.end(JSON.stringify(content));
})

app.post('/addprovidedservice',async function(req,res){
	var user={}
	user.id=req.body.id
	user.srvcategory=req.body.category
	user.service=req.body.service
	user.price=req.body.price
	user.srv_desc=req.body.srv_desc

	console.log('/addprovidedservice',moment().format(format),user)

	if(user===undefined || user.id === undefined || user.price === undefined || user.srvcategory===undefined || user.service===undefined )//|| user.srv_desc===undefined)
	{
		res.status(400).send(JSON.stringify({message:"Bad Request"}));
		console.log("Bad Request")
		return 1;
    }
    
	async function checkUser(user){
        return new Promise(async function(resolve, reject) {
			connection = mysql.createConnection(sql);
            connection.query(`select * from KG_user where userid=${user.id} and usertype="vendor"`,(err,result) => {
                if(err){
					console.error(err);
					var rsv={}
                    rsv.er=err.sqlMessage
                    resolve(rsv);
                }
                resolve(result)
            })
            connection.end()
        });
	}

	async function getSrvcode(user){
        return new Promise(async function(resolve, reject) {
			connection = mysql.createConnection(sql);
            connection.query(`select srvcode from KG_scode where srvcategory="${user.srvcategory}" and subsrv="${user.service}"`,(err,result) => {
                if(err){
					console.error(err);
					var rsv={}
                    rsv.er=err.sqlMessage
                    resolve(rsv);
                }
                resolve(result)
            })
            connection.end()
        });
	}

	async function setProvidedservice(user){
        return new Promise(async function(resolve, reject) {
			connection = mysql.createConnection(sql);
            connection.query(`insert into KG_provided_services (vendor_id, srvcode, price) values (${user.id},${user.srvcode},${user.price})`,(err,result) => {
                if(err){
					console.error(err);
					var rsv={}
                    rsv.er=err.sqlMessage
                    resolve(rsv);
                }
                resolve(result)
            })
            connection.end()
        });
	}

	async function setDescription(user){
        return new Promise(async function(resolve, reject) {
			connection = mysql.createConnection(sql);
            connection.query(`update KG_provided_services set srv_description="${user.srv_desc}" where vendor_id=${user.id} and srvcode=${user.srvcode}`,(err,result) => {
                if(err){
					console.error(err);
					var rsv={}
                    rsv.er=err.sqlMessage
                    resolve(rsv);
                }
                resolve(result)
            })
            connection.end()
        });
	}
	
	chkuser = await checkUser(user)
	console.log(chkuser)

	if(chkuser.length == 0)
	{
		res.status(500).send(JSON.stringify({message:"User not registered or not a vendor"}));
		console.log("User not registered or not a vendor")
		return 1;
	}

	gsrvcode = await getSrvcode(user)
	console.log("srvcode",gsrvcode)

	if(gsrvcode.length == 0)
	{
		res.status(500).send(JSON.stringify({message:"Service category or Service name incorrect"}));
		console.log("Service category or Service name incorrect")
		return 2;
	}

	user.srvcode=gsrvcode[0].srvcode
	setpsrv = await setProvidedservice(user)

	if(setpsrv.er !== undefined)
	{
		res.status(500).send(JSON.stringify({message:`${setpsrv.er}`}));
		console.log(`${setpsrv.er}`)
		return 3;
	}
	if(user.srv_desc !== undefined)
	{
		setdesc = await setDescription(user)

		if(setdesc.er !== undefined)
		{
			res.status(500).send(JSON.stringify({message:`${setdesc.er}`}));
			console.log(`${setdesc.er}`)
			return 3;
		}
	}
	res.status(200).send(JSON.stringify({message:"Provided service set Successful"}));
	console.log("Provided service set Successful")
})

app.get('/sendcategory',async function(req,res){
	
	console.log('/sendcategory',moment().format(format))

	async function getServicecategory(){
		return new Promise(function(resolve, reject) {
			connection = mysql.createConnection(sql);
			connection.query(`select distinct(srvcategory) from KG_scode order by srvcategory`,(err,result) => {
				resolve(result)
			})
			connection.end()
		});
	}

	async function getImagePath(img){
		return new Promise(function(resolve, reject) {
			connection = mysql.createConnection(sql);
			connection.query(`select imgpath from KG_images where imgcategory="${img.category}"`,(err,result)=>{
				if(err){
					console.error(err);
					resolve(undefined);
					return 0;
				}
				else if(result.length<1){
					resolve(undefined);
					return 0;
				}
				resolve(result);
			})
			connection.end()
		});
	}
	
	gscategory = await getServicecategory();
	if (gscategory == undefined || gscategory.length <1 || gscategory[0]== undefined){
		res.status(403).end(JSON.stringify({message:'No category available'}))
		console.log('No category available')
		return 0;
	}
	
	catglist=[]
	gscategory.forEach((x) => {catglist.push({category:x.srvcategory})});
	contnt = {
		list_of_categories: catglist
	}
	user={}
	user.category="categories"
	imPaths = await getImagePath(user)

	if(imPaths == undefined){
		console.log('No images available in this category')
	}
	else
	{
		for(p=0;p<imPaths.length;p++)
		{
			imPaths[p].imgpath=imPaths[p].imgpath.replace(`${config.dirname}`+"/images_ui/",'')
			imPaths[p].imgpath=imPaths[p].imgpath.split('/').join('+')
			imPaths[p].imgpath=imPaths[p].imgpath.split(' ').join('*')
			contnt.list_of_categories[p].img_url=`http://${hostname}:${port}/sendimage/${imPaths[p].imgpath}`
		}
	}
	console.log("category_list",contnt);
	res.writeHead(200, {
         'Content-Type': 'application/json',
         'Content-Length': JSON.stringify(contnt).length
         })
    res.end(JSON.stringify(contnt));
})

app.get('/sendsubservice/:category',async function(req,res){
	user={}
	user.category=req.params.category
	console.log('/sendsubservice',moment().format(format),user)

	if(user===undefined || user.category === undefined)
	{
		res.status(400).send(JSON.stringify({message:"Bad Request"}));
		console.log("Bad Request")
		return 1;
	}
	
	async function getSubservice(user){
		return new Promise(function(resolve, reject) {
			connection = mysql.createConnection(sql);
			connection.query(`select * from KG_scode where srvcategory="${user.category}" order by subsrv`,(err,result) => {
				resolve(result)
			})
			connection.end()
		});
	}

	async function getImagePath(img){
		return new Promise(function(resolve, reject) {
			connection = mysql.createConnection(sql);
			connection.query(`select imgpath from KG_images where imgcategory="${img.category}"`,(err,result)=>{
				if(err){
					console.error(err);
					resolve(undefined);
					return 0;
				}
				else if(result.length<1){
					resolve(undefined);
					return 0;
				}
				resolve(result);
			})
			connection.end()
		});
	}

	gsservice = await getSubservice(user);
	if (gsservice == undefined || gsservice.length <1 || gsservice[0]== undefined){
		res.status(403).end(JSON.stringify({message:'No services available in this category'}))
		console.log('No services available in this category')
		return 0;
	}

	contnt = {
		list_of_subservices: gsservice
	}

	imPaths = await getImagePath(user)

	if(imPaths == undefined){
		//res.status(403).end(JSON.stringify({message:'No images available in this category'}))
		console.log('No images available in this category')
		//return 0;
	}
	else
	{
		for(p=0;p<imPaths.length;p++)
		{
			imPaths[p].imgpath=imPaths[p].imgpath.replace(`${config.dirname}`+"/images_ui/",'')
			imPaths[p].imgpath=imPaths[p].imgpath.split('/').join('+')
			imPaths[p].imgpath=imPaths[p].imgpath.split(' ').join('*')
			contnt.list_of_subservices[p].img_url=`http://${hostname}:${port}/sendimage/${imPaths[p].imgpath}`
		}
	}
	console.log(contnt);
	console.log("service_list",contnt);
	res.writeHead(200, {
         'Content-Type': 'application/json',
         'Content-Length': JSON.stringify(contnt).length
         })
	res.end(JSON.stringify(contnt));
})

app.post('/showvendors',async function(req,res){
	var user={}
	user.srvcategory=req.body.category
	user.service=req.body.service
	user.srvcode=req.body.srvcode

	console.log('/showvendors',moment().format(format),user)
	
	if(user===undefined || ((user.srvcategory === undefined || user.service === undefined) && user.srvcode === undefined))
	{
		res.status(400).send(JSON.stringify({message:"Bad Request"}));
		console.log("Bad Request")
		return 1;
    }

	if(user.srvcode === undefined)
	{
		async function getSrvcode(user){
			return new Promise(async function(resolve, reject) {
				connection = mysql.createConnection(sql);
				connection.query(`select srvcode from KG_scode where srvcategory="${user.srvcategory}" and subsrv="${user.service}"`,(err,result) => {
					if(err){
						console.error(err);
						var rsv={}
						rsv.er=err.sqlMessage
						resolve(rsv);
					}
					resolve(result)
				})
				connection.end()
			});
		}

		gsrvcode = await getSrvcode(user)
		console.log("srvcode",gsrvcode)

		if(gsrvcode.length == 0)
		{
			res.status(500).send(JSON.stringify({message:"Service category or Service name incorrect"}));
			console.log("Service category or Service name incorrect")
			return 2;
		}

		user.srvcode=gsrvcode[0].srvcode
	}

	async function validSrvcode(user){
		return new Promise(function(resolve, reject) {
			connection = mysql.createConnection(sql);
			connection.query(`select * from KG_scode where srvcode=${user.srvcode}`,(err,result) => {
				resolve(result)
			})
			connection.end()
		});
	}

	async function getServicedetails(user){
		return new Promise(function(resolve, reject) {
			connection = mysql.createConnection(sql);
			connection.query(`select A.vendor_id,A.srvcode,A.srv_description,A.price,B.uname,B.email,B.phone_num from KG_provided_services A, KG_user B where A.srvcode=${user.srvcode} and A.vendor_id=B.userid`,(err,result) => {
				resolve(result)
			})
			connection.end()
		});
	}

	vsrvcode = await validSrvcode(user)
	if (vsrvcode == undefined || vsrvcode.length <1 || vsrvcode[0]== undefined){
		res.status(403).end(JSON.stringify({message:"Invalid service code"}))
		console.log("Invalid service code")
		return 0;
	}
	
	gsdetail = await getServicedetails(user);
	if (gsdetail == undefined || gsdetail.length <1 || gsdetail[0]== undefined){
		res.status(403).end(JSON.stringify({message:"No vendor registered for this service"}))
		console.log("No vendor registered for this service")
		return 0;
	}
	
	content = {
		list_of_vendors: gsdetail
	}
	console.log("content",content);
	res.writeHead(200, {
         'Content-Type': 'application/json',
         'Content-Length': JSON.stringify(content).length
         })
    res.end(JSON.stringify(content));
})

app.get('/showbookedservices/:customer_id',async function(req,res){
	user={}
	user.customer_id=req.params.customer_id
	console.log('/showbookedservices',moment().format(format),user)

	if(user===undefined || user.customer_id === undefined)
	{
		res.status(400).send(JSON.stringify({message:"Bad Request"}));
		console.log("Bad Request")
		return 1;
	}
	
	async function checkUser(user){
        return new Promise(async function(resolve, reject) {
			connection = mysql.createConnection(sql);
            connection.query(`select * from KG_user where userid=${user.customer_id} and usertype="customer"`,(err,result) => {
                if(err){
					console.error(err);
					var rsv={}
                    rsv.er=err.sqlMessage
                    resolve(rsv);
                }
                resolve(result)
            })
            connection.end()
        });
	}

	async function getBookedservice(user){
		return new Promise(function(resolve, reject) {
			connection = mysql.createConnection(sql);
			connection.query(`select A.service_id,A.customer_id,A.vendor_id,B.uname,A.srvcode,C.srvcategory,C.subsrv,DATE_FORMAT(A.srvtime,'%Y-%m-%d %k:%i:%S') as srvtime,DATE_FORMAT(A.endtime,'%Y-%m-%d %k:%i:%S') as endtime,A.price,DATE_FORMAT(A.booked_date,'%Y-%m-%d %k:%i:%S') as booked_date from KG_booked_services A,KG_user B,KG_scode C where A.customer_id=${user.customer_id} and A.vendor_id=B.userid and A.srvcode=C.srvcode`,(err,result) => {
				resolve(result)
			})
			connection.end()
		});
	}

	chkuser = await checkUser(user)
	console.log(chkuser)

	if(chkuser.length == 0)
	{
		res.status(500).send(JSON.stringify({message:"User not registered or not a customer"}));
		console.log("User not registered or not a customer")
		return 1;
	}
	
	gbservice = await getBookedservice(user);
	if (gbservice == undefined || gbservice.length <1 || gbservice[0]== undefined){
		res.status(403).end(JSON.stringify({message:'No services booked by customer'}))
		console.log('No services booked by customer')
		return 0;
	}

	content = {
		booked_services: gbservice
	}
	console.log("booked_service_list",content);
	res.writeHead(200, {
         'Content-Type': 'application/json',
         'Content-Length': JSON.stringify(content).length
         })
    res.end(JSON.stringify(content));
})

app.get('/showprovidedservices/:vendor_id',async function(req,res){
	user={}
	user.vendor_id=req.params.vendor_id
	console.log('/showprovidedservices',moment().format(format),user)

	if(user===undefined || user.vendor_id === undefined)
	{
		res.status(400).send(JSON.stringify({message:"Bad Request"}));
		console.log("Bad Request")
		return 1;
	}
	
	async function checkUser(user){
        return new Promise(async function(resolve, reject) {
			connection = mysql.createConnection(sql);
            connection.query(`select * from KG_user where userid=${user.vendor_id} and usertype="vendor"`,(err,result) => {
                if(err){
					console.error(err);
					var rsv={}
                    rsv.er=err.sqlMessage
                    resolve(rsv);
                }
                resolve(result)
            })
            connection.end()
        });
	}

	async function getProvidedservice(user){
		return new Promise(function(resolve, reject) {
			connection = mysql.createConnection(sql);
			connection.query(`select vendor_id,srvcode,price,srv_description from KG_provided_services where vendor_id="${user.vendor_id}"`,(err,result) => {
				resolve(result)
			})
			connection.end()
		});
	}

	async function getBookedpvdservice(user){
		return new Promise(function(resolve, reject) {
			connection = mysql.createConnection(sql);
			connection.query(`select vendor_id,service_id,customer_id,srvcode,price,DATE_FORMAT(srvtime,'%Y-%m-%d %k:%i:%S') as srvtime,DATE_FORMAT(endtime,'%Y-%m-%d %k:%i:%S') as endtime,DATE_FORMAT(booked_date,'%Y-%m-%d %k:%i:%S') as booked_date from KG_booked_services where vendor_id="${user.vendor_id}"`,(err,result) => {
				resolve(result)
			})
			connection.end()
		});
	}

	chkuser = await checkUser(user)
	console.log(chkuser)

	if(chkuser.length == 0)
	{
		res.status(500).send(JSON.stringify({message:"User not registered or not a vendor"}));
		console.log("User not registered or not a vendor")
		return 1;
	}
	
	gpservice = await getProvidedservice(user);
	if (gpservice == undefined || gpservice.length <1 || gpservice[0]== undefined){
		res.status(403).end(JSON.stringify({message:'No services provided by vendor'}))
		console.log('No services provided by vendor')
		return 0;
	}

	gbservice = await getBookedpvdservice(user);
	if (gbservice == undefined || gbservice.length <1 || gbservice[0]== undefined){
		console.log('No services of vendor booked by customer')
	}

	content = {
		provided_services: gpservice,
		booked_pvd_services:gbservice
	}
	console.log("provided_service_list",content);
	res.writeHead(200, {
         'Content-Type': 'application/json',
         'Content-Length': JSON.stringify(content).length
         })
    res.end(JSON.stringify(content));
})

//tested

app.post('/addbookedservice',async function(req,res){
	var user={}
	user.customer_id=req.body.customer_id
	user.vendor_id=req.body.vendor_id
	user.srvcode=req.body.srvcode
	user.pincode=req.body.pincode        
	user.country=req.body.country 
	user.region=req.body.region       
	user.district=req.body.district       
	user.locality=req.body.locality
    user.building_street=req.body.building_street  
	user.landmark=req.body.landmark
	user.srvtime=req.body.srvtime
	user.endtime=req.body.endtime
	console.log('/addbookedservice',moment().format(format),user)

	if(user===undefined || user.srvtime === undefined || user.customer_id === undefined || user.vendor_id === undefined || user.pincode === undefined || user.country === undefined || user.district === undefined || user.locality === undefined || user.building_street === undefined || user.srvcode === undefined || user.region === undefined)
	{
		res.status(400).send(JSON.stringify({message:"Bad Request"}));
		console.log("Bad Request")
		return 1;
	}
	
	if(user.pincode <= 100000 || user.pincode >=1000000)
	{
		res.status(400).send(JSON.stringify({message:"Invalid pincode"}));
		console.log("Invalid pincode")
		return 1;
	}
	if(user.landmark === undefined)
	{
		user.landmark='null'
	}
	else
	{
		user.landmark='"'+user.landmark+'"'
	}

	format="YYYY-MM-DD HH:mm:ss"
	tformat="HH:mm:ss"
	dformat="YYYY-MM-DD"

	if(!moment(user.srvtime,format,true).isValid() || !moment(user.endtime,format,true).isValid())
	{
		res.status(400).send(JSON.stringify({message:"Invalid time format"}));
		console.log("Invalid time format")
		return 1;
	}

	srvtime=moment(user.srvtime,format)
	endtime=moment(user.endtime,format)
	dur=srvtime.diff(endtime,'seconds')
	stm=moment("08:59:59",tformat)
	etm=moment("21:00:00",tformat)
	stime=moment(moment(srvtime).format(tformat),tformat)
	etime=moment(moment(endtime).format(tformat),tformat)
	today=moment(moment().format(format),format)
	endday=moment(today,format).add('1','week').set({hour:0,minute:0,second:0,millisecond:0})
	sdate=moment(moment(srvtime).format(dformat),dformat)
	edate=moment(moment(endtime).format(dformat),dformat)

	if(srvtime.isSame(endtime))
	{
		res.status(400).send(JSON.stringify({message:'Both time cannot be same'}));
		console.log('Both time cannot be same')
		return 1;
	}
	else if(!sdate.isSame(edate))
	{
		res.status(400).send(JSON.stringify({message:'Both date should be same'}));
		console.log('Both date should be same')
		return 1;
	}
	else if(dur>=0)
	{
		res.status(400).send(JSON.stringify({message:'End time cannot be before start time'}));
		console.log('End time cannot be before start time')
		return 1;
	}
	else if(!stime.isBetween(stm,etm) || !etime.isBetween(stm,etm))
	{
		res.status(400).send(JSON.stringify({message:"Both time should be within 9am - 9pm"}));
		console.log("Both time should be within 9am - 9pm")
		return 1;
	}
	else if(!srvtime.isAfter(today) || !endtime.isAfter(today))
	{
		res.status(400).send(JSON.stringify({message:'srvtime and endtime should be future'}));
		console.log('srvtime and endtime should be future')
		return 1;
	}
	else if(!srvtime.isBetween(today,endday) || !endtime.isBetween(today,endday))
	{
		res.status(400).send(JSON.stringify({message:"Pre booking only available for a week"}));
		console.log("Pre booking only available for a week")
		return 1;
	}

	sqlsrvtime =  String(srvtime.format("YYYY-MM-DD HH:mm:ss",true))
	sqlendtime =  String(endtime.format("YYYY-MM-DD HH:mm:ss",true))
	console.log("INPUT TIME",sqlsrvtime,sqlendtime)
	async function checkUser(id){
        return new Promise(async function(resolve, reject) {
			connection = mysql.createConnection(sql);
            connection.query(`select usertype from KG_user where userid=${id}`,(err,result) => {
                if(err){
					console.error(err);
					var rsv={}
                    rsv.er=err.sqlMessage
                    resolve(rsv);
                }
                resolve(result)
            })
            connection.end()
        });
	}

	async function checkSrvcode(user){
        return new Promise(async function(resolve, reject) {
			connection = mysql.createConnection(sql);
            connection.query(`select * from KG_scode where srvcode=${user.srvcode}`,(err,result) => {
                if(err){
					console.error(err);
					var rsv={}
                    rsv.er=err.sqlMessage
                    resolve(rsv);
                }
                resolve(result)
            })
            connection.end()
        });
	}

	async function getVendorservice(user){
        return new Promise(async function(resolve, reject) {
			connection = mysql.createConnection(sql);
            connection.query(`select * from KG_provided_services where vendor_id=${user.vendor_id} and srvcode=${user.srvcode}`,(err,result) => {
                if(err){
					console.error(err);
					var rsv={}
                    rsv.er=err.sqlMessage
                    resolve(rsv);
                }
                resolve(result)
            })
            connection.end()
        });
	}

	async function CheckRequiredservice(user,booked){
        return new Promise(async function(resolve, reject) {
			connection = mysql.createConnection(sql);
			connection.query(`select * from KG_required_services where customer_id=${user.customer_id}`,(err,result) => {
                if(err){
					console.error(err);
					var rsv={}
                    rsv.er=err.sqlMessage
                    resolve(rsv);
                }
                resolve(result)
            })
            connection.end()
        });
	}

	async function setRequiredservice(user,booked){
        return new Promise(async function(resolve, reject) {
			connection = mysql.createConnection(sql);
			connection.query(`insert into KG_required_services (customer_id, srvcode, booked) values (${user.customer_id},${user.srvcode},${booked})`,(err,result) => {
                if(err){
					console.error(err);
					var rsv={}
                    rsv.er=err.sqlMessage
                    resolve(rsv);
                }
                resolve(result)
            })
            connection.end()
        });
	}

	async function setBookedservice(user){
        return new Promise(async function(resolve, reject) {
			connection = mysql.createConnection(sql);
			connection.query(`insert into KG_booked_services (customer_id, vendor_id, srvcode, price, booked_date, pincode, country, region, district, locality, building_street, landmark, srvtime, endtime) values (${user.customer_id},${user.vendor_id},${user.srvcode},${user.price},NOW(),${user.pincode},"${user.country}","${user.region}","${user.district}","${user.locality}","${user.building_street}",${user.landmark},"${sqlsrvtime}","${sqlendtime}")`,(err,result) => {
                if(err){
					console.error(err);
					var rsv={}
                    rsv.er=err.sqlMessage
                    resolve(rsv);
                }
                resolve(result)
            })
            connection.end()
        });
	}

	async function showBookedservice(user){
        return new Promise(async function(resolve, reject) {
			connection = mysql.createConnection(sql);
			console.log(`select service_id,customer_id,vendor_id,srvcode,DATE_FORMAT(srvtime,'%Y-%m-%d %k:%i:%S') as srvtime,DATE_FORMAT(endtime,'%Y-%m-%d %k:%i:%S') as endtime from KG_booked_services where customer_id=${user.customer_id}`)
			connection.query(`select service_id,customer_id,vendor_id,srvcode,DATE_FORMAT(srvtime,'%Y-%m-%d %k:%i:%S') as srvtime,DATE_FORMAT(endtime,'%Y-%m-%d %k:%i:%S') as endtime from KG_booked_services where customer_id=${user.customer_id}`,(err,result) => {
                if(err){
					console.error(err);
					var rsv={}
                    rsv.er=err.sqlMessage
                    resolve(rsv);
                }
                resolve(result)
            })
            connection.end()
        });
	}
	
	chkcustomer = await checkUser(user.customer_id)
	console.log("customer",chkcustomer)

	if(chkcustomer.length == 0)
	{
		res.status(500).send(JSON.stringify({message:"Incorrect customer_id"}));
		console.log("Incorrect customer_id")
		return 1;
	}
	if(chkcustomer[0].usertype !== "customer")
	{
		res.status(500).send(JSON.stringify({message:"Customer_id not registered as customer"}));
		console.log("Customer_id not registered as customer")
		return 1;
	}

	chkvendor = await checkUser(user.vendor_id)
	console.log("vendor",chkvendor)

	if(chkvendor.length == 0)
	{
		res.status(500).send(JSON.stringify({message:"Incorrect vendor_id"}));
		console.log("Incorrect vendor_id")
		return 1;
	}
	if(chkvendor[0].usertype !== "vendor")
	{
		res.status(500).send(JSON.stringify({message:"Vendor_id not registered as vendor"}));
		console.log("Vendor_id not registered as vendor")
		return 1;
	}

	chksrvcode = await checkSrvcode(user)
	console.log("srvcode",chksrvcode)

	if(chksrvcode.length == 0)
	{
		res.status(500).send(JSON.stringify({message:"Incorrect srvcode"}));
		console.log("Incorrect srvcode")
		return 2;
	}

	gvservice = await getVendorservice(user)
	console.log("vendor service",gvservice)

	if(gvservice.length == 0)
	{
		res.status(500).send(JSON.stringify({message:"Vendor-service not registered"}));
		console.log("Vendor-service not registered")
		return 1;
	}
	
	user.price=gvservice[0].price

	chkrsrv = await CheckRequiredservice(user)

	if(chkrsrv.length == 0)
	{
		setrsrv = await setRequiredservice(user,1)

		if(setrsrv.er !== undefined)
		{
			res.status(500).send(JSON.stringify({message:`${setrsrv.er}`}));
			console.log(`${setrsrv.er}`)
			return 3;
		}
	}

	setbsrv = await setBookedservice(user)

	if(setbsrv.er !== undefined)
	{
		res.status(500).send(JSON.stringify({message:`${setbsrv.er}`}));
		console.log(`${setbsrv.er}`)
		return 3;
	}

	showbsrv = await showBookedservice(user)

	content = {
		services_booked_by_customer : showbsrv
	}
	console.log("content",content);
	res.writeHead(200, {
         'Content-Type': 'application/json',
         'Content-Length': JSON.stringify(content).length
         })
    res.end(JSON.stringify(content));
})

app.post('/adddiscountcoupon',async function(req,res){
	var user={}
	user.srvcode=req.body.srvcode
	user.coupon_code=req.body.coupon_code
	user.discount_type=req.body.discount_type //percent or value
	user.discount_price=req.body.discount_price
	user.valid_from=req.body.valid_from
	user.valid_till=req.body.valid_till

	console.log('/adddiscountcoupon',moment().format(format),user)

	if(user===undefined || user.discount_type === undefined || user.discount_price === undefined || user.srvcode === undefined || user.coupon_code === undefined || user.valid_from === undefined || user.valid_till === undefined )
	{
		res.status(400).send(JSON.stringify({message:"Bad Request"}));
		console.log("Bad Request")
		return 1;
	}

	if(user.discount_type !== "percent" && user.discount_type !== "value")
	{
		res.status(400).send(JSON.stringify({message:"Bad Request"}));
		console.log("Bad Request")
		return 1;
	}
	
	if(user.discount_type === "percent")
	{
		if(user.discount_price > 99 || user.discount_price < 1)
		{
			res.status(400).send(JSON.stringify({message:"Discount percent should be within 1 to 99"}));
			console.log("Discount percent should be within 1 to 99")
			return 1;
		}
	}

	format="YYYY-MM-DD HH:mm:ss"

	if(!moment(user.valid_from,format,true).isValid() || !moment(user.valid_till,format,true).isValid())
	{
		res.status(400).send(JSON.stringify({message:"Invalid time format"}));
		console.log("Invalid time format")
		return 1;
	}

	valid_from=moment(user.valid_from,format)
	valid_till=moment(user.valid_till,format)
	now=moment(moment().format(format),format)

	dur=valid_from.diff(valid_till,'seconds')
	
	if(valid_from.isSame(valid_till))
	{
		res.status(400).send(JSON.stringify({message:'valid_from and valid_till cannot be same'}));
		console.log('valid_from and valid_till cannot be same')
		return 1;
	}
	else if(dur>=0)
	{
		res.status(400).send(JSON.stringify({message:'valid_till cannot be before valid_from'}));
		console.log('valid_till cannot be before valid_from')
		return 1;
	}
	else if(!valid_from.isAfter(now) || !valid_till.isAfter(now))
	{
		res.status(400).send(JSON.stringify({message:'valid_till and valid_from should be future'}));
		console.log('valid_till and valid_from should be future')
		return 1;
	}
	   
	sqlvalid_from =  String(valid_from.format("YYYY-MM-DD HH:mm:ss",true))
	sqlvalid_till =  String(valid_till.format("YYYY-MM-DD HH:mm:ss",true))
	async function checkSrvcode(user){
        return new Promise(async function(resolve, reject) {
			connection = mysql.createConnection(sql);
            connection.query(`select * from KG_scode where srvcode=${user.srvcode}`,(err,result) => {
                if(err){
					console.error(err);
					var rsv={}
                    rsv.er=err.sqlMessage
                    resolve(rsv);
                }
                resolve(result)
            })
            connection.end()
        });
	}

	async function setDiscount(user){
        return new Promise(async function(resolve, reject) {
			connection = mysql.createConnection(sql);
            connection.query(`insert into KG_service_discount (srvcode, coupon_code, discount_${user.discount_type}, date_created, valid_from, valid_till) values (${user.srvcode},"${user.coupon_code}",${user.discount_price},NOW(),"${sqlvalid_from}","${sqlvalid_till}")`,(err,result) => {
                if(err){
					console.error(err);
					var rsv={}
                    rsv.er=err.sqlMessage
                    resolve(rsv);
                }
                resolve(result)
            })
            connection.end()
        });
	}

	chksrvcode = await checkSrvcode(user)
	console.log("srvcode",chksrvcode)

	if(chksrvcode.length == 0)
	{
		res.status(500).send(JSON.stringify({message:"Incorrect srvcode"}));
		console.log("Incorrect srvcode")
		return 2;
	}
	
	setdct = await setDiscount(user)

	if(setdct.er !== undefined)
	{
		res.status(500).send(JSON.stringify({message:`${setdct.er}`}));
		console.log(`${setdct.er}`)
		return 3;
	}
	
	res.status(200).send(JSON.stringify({message:"Coupon code set Successful"}));
	console.log("Coupon code set Successful")
})

app.post('/showserviceprice',async function(req,res){
	var user={}
	user.service_id=req.body.service_id

	console.log('/showserviceprice',moment().format(format),user)

	if(user===undefined || user.service_id === undefined) 	
	{
		res.status(400).send(JSON.stringify({message:"Bad Request"}));
		console.log("Bad Request")
		return 1;
	}
	
	async function checkSrvid(user){
        return new Promise(async function(resolve, reject) {
			connection = mysql.createConnection(sql);
            connection.query(`select * from KG_booked_services where service_id=${user.service_id}`,(err,result) => {
                if(err){
					console.error(err);
					var rsv={}
                    rsv.er=err.sqlMessage
                    resolve(rsv);
                }
                resolve(result)
            })
            connection.end()
        });
	}

	async function checkPaymentsrvid(user){
        return new Promise(async function(resolve, reject) {
			connection = mysql.createConnection(sql);
            connection.query(`select * from KG_payment where service_id=${user.service_id}`,(err,result) => {
                if(err){
					console.error(err);
					var rsv={}
                    rsv.er=err.sqlMessage
                    resolve(rsv);
                }
                resolve(result)
            })
            connection.end()
        });
	}

	async function setPaymentprice(user){
        return new Promise(async function(resolve, reject) {
			connection = mysql.createConnection(sql);
			connection.query(`insert into KG_payment(service_id, price, cgst, sgst, igst, pay_status) values (${user.service_id},${user.price},${user.cgst},${user.sgst},${user.igst},0)`,(err,result) => {
                if(err){
					console.error(err);
					var rsv={}
                    rsv.er=err.sqlMessage
                    resolve(rsv);
                }
                resolve(result)
            })
            connection.end()
        });
	}

	async function showPaymentprice(user){
        return new Promise(async function(resolve, reject) {
			connection = mysql.createConnection(sql);
			connection.query(`select service_id, discount_id, price, cgst, sgst, igst from KG_payment where service_id=${user.service_id}`,(err,result) => {
                if(err){
					console.error(err);
					var rsv={}
                    rsv.er=err.sqlMessage
                    resolve(rsv);
                }
                resolve(result)
            })
            connection.end()
        });
	}

	chksrv = await checkSrvid(user)

	if(chksrv.length == 0 || chksrv.length>1)
	{
		res.status(500).send(JSON.stringify({message:"Service_id incorrect"}));
		console.log("Service_id incorrect")
		return 1;
	}

	chkpsrv = await checkPaymentsrvid(user)

	if(chkpsrv.length == 0)
	{
		chksrv=chksrv[0]
		console.log(chksrv)
		user.region=chksrv.region
		user.price=chksrv.price

		if(user.region.toLowerCase() === "maharashtra")
		{
			user.cgst=user.price*(9/100)
			user.sgst=user.price*(9/100)
			user.igst=0
		}
		else
		{
			user.igst=user.price*(18/100)
			user.cgst=0
			user.sgst=0
		}

		setpprc = await setPaymentprice(user)

		if(setpprc.er !== undefined)
		{
			res.status(500).send(JSON.stringify({message:`${setpprc.er}`}));
			console.log(`${setpprc.er}`)
			return 3;
		}
	}

	showpprc = await showPaymentprice(user)

	content = {
		price_of_service : showpprc
	}
	console.log("content",content);
	res.writeHead(200, {
         'Content-Type': 'application/json',
         'Content-Length': JSON.stringify(content).length
         })
    res.end(JSON.stringify(content));
})

app.post('/confirmbooking',async function(req,res){
	var user={}
	user.service_id=req.body.service_id
	user.coupon_code=req.body.coupon_code

	console.log('/confirmbooking',moment().format(format),user)

	if(user===undefined || user.service_id === undefined) 	
	{
		res.status(400).send(JSON.stringify({message:"Bad Request"}));
		console.log("Bad Request")
		return 1;
	}
	
	async function checkSrvid(user){
        return new Promise(async function(resolve, reject) {
			connection = mysql.createConnection(sql);
            connection.query(`select * from KG_booked_services where service_id=${user.service_id}`,(err,result) => {
                if(err){
					console.error(err);
					var rsv={}
                    rsv.er=err.sqlMessage
                    resolve(rsv);
                }
                resolve(result)
            })
            connection.end()
        });
	}

	async function setConfirmbooked(user){
        return new Promise(async function(resolve, reject) {
			connection = mysql.createConnection(sql);
			query=`update KG_booked_services set cur_status=1,booked_date=NOW() where service_id=${user.service_id}`
			console.log(query)
			connection.query(query,(err,result) => {
                if(err){
					console.error(err);
					var rsv={}
                    rsv.er=err.sqlMessage
                    resolve(rsv);
                }
                resolve(result)
            })
            connection.end()
        });
	}

	async function checkCouponcode(user){
        return new Promise(async function(resolve, reject) {
			connection = mysql.createConnection(sql);
            connection.query(`select discount_id,srvcode,coupon_code,discount_percent,discount_value,DATE_FORMAT(valid_from,'%Y-%m-%d %k:%i:%S') as valid_from,DATE_FORMAT(valid_till,'%Y-%m-%d %k:%i:%S') as valid_till from KG_service_discount where coupon_code="${user.coupon_code}"`,(err,result) => {
                if(err){
					console.error(err);
					var rsv={}
                    rsv.er=err.sqlMessage
                    resolve(rsv);
                }
                resolve(result)
            })
            connection.end()
        });
	}

	async function checkPaymentsrvid(user){
        return new Promise(async function(resolve, reject) {
			connection = mysql.createConnection(sql);
            connection.query(`select * from KG_payment where service_id=${user.service_id}`,(err,result) => {
                if(err){
					console.error(err);
					var rsv={}
                    rsv.er=err.sqlMessage
                    resolve(rsv);
                }
                resolve(result)
            })
            connection.end()
        });
	}

	async function setPaymentprice(user){
        return new Promise(async function(resolve, reject) {
			connection = mysql.createConnection(sql);
			connection.query(`insert into KG_payment(service_id, price, cgst, sgst, igst, pay_status) values (${user.service_id},${user.price},${user.cgst},${user.sgst},${user.igst},0)`,(err,result) => {
                if(err){
					console.error(err);
					var rsv={}
                    rsv.er=err.sqlMessage
                    resolve(rsv);
                }
                resolve(result)
            })
            connection.end()
        });
	}

	async function setPdiscountprice(user){
        return new Promise(async function(resolve, reject) {
			connection = mysql.createConnection(sql);
			connection.query(`insert into KG_payment(discount_id, service_id, price, cgst, sgst, igst, pay_status) values (${user.discount_id},${user.service_id},${user.price},${user.cgst},${user.sgst},${user.igst},0)`,(err,result) => {
                if(err){
					console.error(err);
					var rsv={}
                    rsv.er=err.sqlMessage
                    resolve(rsv);
                }
                resolve(result)
            })
            connection.end()
        });
	}

	async function updateforDiscountprice(user){
        return new Promise(async function(resolve, reject) {
			connection = mysql.createConnection(sql);
			connection.query(`update KG_payment set discount_id=${user.discount_id},price=${user.price},cgst=${user.cgst},sgst=${user.sgst},igst=${user.igst} where service_id=${user.service_id}`,(err,result) => {
                if(err){
					console.error(err);
					var rsv={}
                    rsv.er=err.sqlMessage
                    resolve(rsv);
                }
                resolve(result)
            })
            connection.end()
        });
	}

	async function showPaymentprice(user){
        return new Promise(async function(resolve, reject) {
			connection = mysql.createConnection(sql);
			connection.query(`select service_id, discount_id, price, cgst, sgst, igst from KG_payment where service_id=${user.service_id}`,(err,result) => {
                if(err){
					console.error(err);
					var rsv={}
                    rsv.er=err.sqlMessage
                    resolve(rsv);
                }
                resolve(result)
            })
            connection.end()
        });
	}

	chksrv = await checkSrvid(user)

	if(chksrv.length == 0)
	{
		res.status(500).send(JSON.stringify({message:"Service_id incorrect"}));
		console.log("Service_id incorrect")
		return 1;
	}

	chksrv=chksrv[0]

	if(user.coupon_code === undefined)
	{
		chkpsrv = await checkPaymentsrvid(user)

		if(chkpsrv.length == 0)
		{
			user.region=chksrv.region
			user.price=chksrv.price
			if(user.region.toLowerCase() === "maharashtra")
			{
				user.cgst=user.price*(9/100)
				user.sgst=user.price*(9/100)
				user.igst=0
			}
			else
			{
				user.igst=user.price*(18/100)
				user.cgst=0
				user.sgst=0
			}

			setpprc = await setPaymentprice(user)

			if(setpprc.er !== undefined)
			{
				res.status(500).send(JSON.stringify({message:`${setpprc.er}`}));
				console.log(`${setpprc.er}`)
				return 3;
			}
		}

		setcnfm = await setConfirmbooked(user)
		if(setcnfm.er !== undefined)
		{
			res.status(500).send(JSON.stringify({message:`${setcnfm.er}`}));
			console.log(`${setcnfm.er}`)
			return 3;
		}

		showpprc = await showPaymentprice(user)

		content = {
			price_of_service : showpprc
		}
	}
	else if(user.coupon_code !== undefined)
	{
		chkccode = await checkCouponcode(user)

		if(chkccode.length == 0)
		{
			res.status(500).send(JSON.stringify({message:"Invalid Coupon code"}));
			console.log("Invalid Coupon code")
			return 1;
		}
		chkccode=chkccode[0]

		if(chksrv.srvcode !== chkccode.srvcode)
		{
			res.status(500).send(JSON.stringify({message:`Coupon code not applicable for this service [no:${chksrv.srvcode}] [yes:${chkccode.srvcode}]`}));
			console.log(`Coupon code not applicable for this service [no:${chksrv.srvcode}] [yes:${chkccode.srvcode}]`)
			return 1;
		}
		format="YYYY-MM-DD HH:mm:ss"
		timenow=moment(moment().format(format),format)
		valid_from=moment(chkccode.valid_from,format)
		valid_till=moment(chkccode.valid_till,format)

		if(!timenow.isBetween(valid_from,valid_till))
		{
			res.status(500).send(JSON.stringify({message:"Coupon code expired or not in coupon active time"}));
			console.log("Coupon code expired or not in coupon active time")
			return 1;
		}

		user.actual_price=chksrv.price
		user.discount_id=chkccode.discount_id

		if(chkccode.discount_percent === 0 && chkccode.discount_value !== 0)
		{
			user.discount_percent=0
			user.discount_value=chkccode.discount_value
			user.price=chksrv.price-chkccode.discount_value
		}
		else if(chkccode.discount_value === 0 && chkccode.discount_percent !== 0)
		{
			user.discount_value=0
			user.discount_percent=chkccode.discount_percent
			user.price=chksrv.price*(1-(chkccode.discount_percent/100))
		}

		user.region=chksrv.region

		if(user.region.toLowerCase() === "maharashtra")
		{
			user.cgst=user.price*(9/100)
			user.sgst=user.price*(9/100)
			user.igst=0
		}
		else
		{
			user.igst=user.price*(18/100)
			user.cgst=0
			user.sgst=0
		}
		chkpsrv = await checkPaymentsrvid(user)

		if(chkpsrv.length == 0)
		{
			setpprc = await setPdiscountprice(user)

			if(setpprc.er !== undefined)
			{
				res.status(500).send(JSON.stringify({message:`${setpprc.er}`}));
				console.log(`${setpprc.er}`)
				return 3;
			}
		}
		else if(chkpsrv.length>0)
		{
			setdscnt = await updateforDiscountprice(user)

			if(setdscnt.er !== undefined)
			{
				res.status(500).send(JSON.stringify({message:`${setdscnt.er}`}));
				console.log(`${setdscnt.er}`)
				return 3;
			}
		}

		setcnfm = await setConfirmbooked(user)
		if(setcnfm.er !== undefined)
		{
			res.status(500).send(JSON.stringify({message:`${setcnfm.er}`}));
			console.log(`${setcnfm.er}`)
			return 3;
		}

		showpprc = await showPaymentprice(user)

		content = {
			price_of_service : showpprc,
			price_before_discount : user.actual_price
		}
	}	
	console.log("content",content);
	res.writeHead(200, {
		'Content-Type': 'application/json',
		'Content-Length': JSON.stringify(content).length
		})
	res.end(JSON.stringify(content));
})

app.post('/servicereview',async function(req,res){
	var user={}
	user.service_id=req.body.service_id
	user.rating=req.body.srvrating
	user.comment=req.body.srvcomment

	console.log('/servicereview',moment().format(format),user)

	if(user===undefined || user.service_id === undefined || user.rating === undefined || user.comment === undefined) 	
	{
		res.status(400).send(JSON.stringify({message:"Bad Request"}));
		console.log("Bad Request")
		return 1;
	}
	
	async function checkSrvid(user){
        return new Promise(async function(resolve, reject) {
			connection = mysql.createConnection(sql);
            connection.query(`select service_id from KG_booked_services where service_id=${user.service_id}`,(err,result) => {
                if(err){
					console.error(err);
					var rsv={}
                    rsv.er=err.sqlMessage
                    resolve(rsv);
                }
                resolve(result)
            })
            connection.end()
        });
	}

	async function setRating(user){
        return new Promise(async function(resolve, reject) {
			connection = mysql.createConnection(sql);
			query=`update KG_booked_services set rating=${user.rating}, comments="${user.comment}" where service_id=${user.service_id}`
			console.log(query)
			connection.query(query,(err,result) => {
                if(err){
					console.error(err);
					var rsv={}
                    rsv.er=err.sqlMessage
                    resolve(rsv);
                }
                resolve(result)
            })
            connection.end()
        });
	}

	chksrv = await checkSrvid(user)

	if(chksrv.length == 0)
	{
		res.status(500).send(JSON.stringify({message:"Service not booked"}));
		console.log("Service not booked")
		return 1;
	}

	
	setrat = await setRating(user)
	if(setrat.er !== undefined)
	{
		res.status(500).send(JSON.stringify({message:`${setrat.er}`}));
		console.log(`${setrat.er}`)
		return 3;
	}
	
	res.status(200).send(JSON.stringify({message:"Rating set Successful"}));
	console.log("Rating set Successful")
})

app.post('/changephonenumber',async function(req,res){
	var user={}
	user.id=req.body.userid
	user.new_phno=req.body.new_phno

	console.log('/changephonenumber',moment().format(format),user)

	if(user===undefined || user.id === undefined || user.new_phno === undefined) 	
	{
		res.status(400).send(JSON.stringify({message:"Bad Request"}));
		console.log("Bad Request")
		return 1;
	}
	
	async function checkUser(user){
        return new Promise(async function(resolve, reject) {
			connection = mysql.createConnection(sql);
            connection.query(`select * from KG_user where userid=${user.id}`,(err,result) => {
                if(err){
					console.error(err);
					var rsv={}
                    rsv.er=err.sqlMessage
                    resolve(rsv);
                }
                resolve(result)
            })
            connection.end()
        });
	}

	async function setNewphno(user){
        return new Promise(async function(resolve, reject) {
			connection = mysql.createConnection(sql);
			query=`update KG_user set phone_num="${user.new_phno}",ver_phno=0 where userid=${user.id}`
			console.log(query)
			connection.query(query,(err,result) => {
                if(err){
					console.error(err);
					var rsv={}
                    rsv.er=err.sqlMessage
                    resolve(rsv);
                }
                resolve(result)
            })
            connection.end()
        });
	}

	chkuser = await checkUser(user)

	if(chkuser.length == 0)
	{
		res.status(500).send(JSON.stringify({message:"User not registered"}));
		console.log("User not registered")
		return 1;
	}
	
	setrat = await setNewphno(user)
	if(setrat.er !== undefined)
	{
		res.status(500).send(JSON.stringify({message:`${setrat.er}`}));
		console.log(`${setrat.er}`)
		return 3;
	}
	
	res.status(200).send(JSON.stringify({message:"Phone number changed Successful"}));
	console.log("Phone number changed Successful")
})

var server = http.Server(app)

server.listen(port,hostname,async function(){
    console.log(`app listening at http://${hostname}:${port}`)
})
