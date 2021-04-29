const GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;
const strategy = require('passport-facebook')
const FacebookStrategy = strategy.Strategy;
const config = require('./config')
const mysql = require('mysql')
const creds = require('./database_auth_mod')

sql = {
    host	: creds.sqlhost,
    user	: creds.sqluser,
	password: creds.sqlpass,
	port	: 3306,
    database: 'k2gservices'
}
async function getDetails(user){
    return new Promise(function(resolve, reject) {
        connection = mysql.createConnection(sql);
        connection.query(`select * from KG_customer where uname = "${user.firstname}${user.lastname}${user.id}" or email = "${user.email}"`,(err,result) => {
            resolve(result)
        })
        connection.end()
    });
}

async function setUserDetails(user,picture){
    return new Promise(function(resolve, reject) {
            connection = mysql.createConnection(sql);
            var query=`insert into KG_customer (uname,email,picture) values ("${user.firstname}${user.lastname}${user.id}","${user.email}","${picture}")`
            
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

module.exports = (passport) => {
    passport.serializeUser((user, done) => {
        done(null, user);
    });    
    
    passport.deserializeUser((user, done) => {
        done(null, user);
    });
    
    passport.use(new GoogleStrategy({
            clientID: "1028728914020-r9elbhnfs5g8n76iedosc80efg4v2ria.apps.googleusercontent.com",
            clientSecret: "5UCZ-Wp3ur1UHXOz_xNboUlx",
            callbackURL: `http://${config.hostname}:${config.port}/auth/google/callback`
        },async function(accessToken, refreshToken, profile, done){
            const { sub , email, given_name, family_name, picture, name} = profile._json;
              const userData = {
                id: sub,  
                email: email,
                firstname: given_name,
                lastname: family_name,
                name: name,
                atoken: accessToken,
                picture: picture
              };
              console.log(userData)
              reg_user = await getDetails(userData);
	          if (reg_user == undefined || reg_user.length <1 || reg_user[0]== undefined){
                insertDetails = await setUserDetails(userData,userData.picture);
        
                if (insertDetails.er !== undefined){
                    console.log({message:`${insertDetails.er}`})
                }
            }
            else{
                console.log("user already registered")
            }
              return done(null, userData);
        }));
    
    passport.use(new FacebookStrategy({
              clientID: 710020036438009,
              clientSecret: '751bb325da693431777d0ed6f5683549',
              callbackURL: `http://${config.hostname}:${config.port}/auth/facebook/callback`,
              passReqToCallback: true,
              profileFields: ['id', 'name','picture.type(large)', 'emails', 'displayName', 'about', 'gender']
            },async function(req,accessToken, refreshToken, profile, done) {
              const { id , email, first_name, last_name, picture, name} = profile._json;
              const userData = {
                id: id,  
                email: email,
                firstname: first_name,
                lastname: last_name,
                name: name,
                atoken: accessToken,
                picture: picture
              }
              //req.user=userData
              console.log(userData)
              reg_user = await getDetails(userData);
	          if (reg_user == undefined || reg_user.length <1 || reg_user[0]== undefined){
                insertDetails = await setUserDetails(userData,userData.picture.data.url);
        
                if (insertDetails.er !== undefined){
                    console.log({message:`${insertDetails.er}`})
                }
            }
            else{
                console.log("user already registered")
            }
              return done(null,userData);
    }));
            
}