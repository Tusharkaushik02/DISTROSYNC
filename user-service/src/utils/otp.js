//generateand store otp
// 1.make a key with email id 
// 2.get number of counts 
// 3.then check if it is greater than 5 throw error otherwise continue
// 4.genrate otp by otpgenrator lib 
// 5.generate sessionif by crypto
// 6.then hash the otp 
// 7.then set on redis 
// return otp and otp session id 



// verifyotp 
// 1.make a sessionkey by session id 
// 2.if not exists then thorw return null  other wise continue
// 3.then prse the data get from redis 
// 4.make a attemos key 
// 5.check number of attempts 
// 6.if it is gereator then 5 then thorw error
// 7.hashed otp and useotp match 
// if ok then delted current sessionkey ,attempts,otp rate limit key 
// otherwise inc and expire set 