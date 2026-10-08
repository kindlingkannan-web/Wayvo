/** @type {import('next').NextConfig} */
const config={reactStrictMode:true,compiler:{removeConsole:process.env.NODE_ENV==="production"}};
module.exports=config;
