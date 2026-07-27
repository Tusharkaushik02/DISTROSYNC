//send otp
//1.chek user existendce 
//2.hashpassword 
// 3.generateotp and store otp 
// 4.send notifcation 
// 5. return otpsessionid


//verify otp
// 1.call varifcation function 
// 2.create account 

//login
// 1.check user
// 2.password match 
// 3.genrate accesstoken  
// 4.set jti in redis 
// 5.set user in redish for chache
// 5.return accesstoken and regeshtoken and user




//refresh token 

// 1.check refresh token 
// 2.check stored key witj userid and deviceis 
// 3.if exist then continue otherwise throw error
// 4.generate token 
// 5.set on redis with userid and device id 
// 6. then return accesstoken refreshtoken and user