var Utils = {
    id:function(){
        var ret = '';
        for(var chars="0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_".split(''),i=0;i<75;i++){
            ret += chars[~~(Math.random() * chars.length)];
        }
        return ret;
    },
    resolveZhiHuRelativeURL:function(p,url){
        return url.replace(/\/question\/\d+/g, p);
    }
};
 
module.exports = Utils;
