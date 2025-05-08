module.exports = {
    apps: [{
        name: "3dash-server", // Name of your application
        script: "index.js", // Entry point of your application
        interpreter: "bun", // Bun interpreter
        //outptut: "latest.log",
        env: {
            PATH: `${process.env.HOME}/.bun/bin:${process.env.PATH}`, // Add "~/.bun/bin/bun" to PATH
        }
    }]
};