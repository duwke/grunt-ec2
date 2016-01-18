'use strict';

var chalk = require('chalk');
var util = require('util');
var conf = require('./lib/conf.js');
var commands = require('./lib/commands.js');
var workflow = require('./lib/workflow.js');
var ssh = require('./lib/ssh.js');
var sshCredentials = require('./lib/sshCredentials.js');
var NodeGit = require("nodegit");

module.exports = function (grunt) {

    var gitUrl = "";
    var gitBranchName = "";
    var checkin = "";
    grunt.registerTask('ec2-deploy', 'Deploys to the instance using `git`, reloads `pm2` and `nginx`', function (name) {
        conf.init(grunt);

        var done = this.async();
        if (arguments.length === 0) {
            grunt.fatal([
                'You should provide an instance name.',
                'e.g: ' + chalk.yellow('grunt ec2-deploy:name')
            ].join('\n'));
        }
        var path = require("path").resolve("./"); // this should be the current path
        
        NodeGit.Repository.open(path).then(function (repo) {
            repo.getCurrentBranch().then(function(branch) {
                NodeGit.Branch.name(branch).then(function(branchName) {
                    gitBranchName = branchName;
                    CheckGitInfo(name, done);
                // Use string
                }, function (reasonForFailure2) {
                            grunt.fatal([reasonForFailure2].join('\n'));
                });
            });
            NodeGit.Remote.lookup(repo, "origin").then(function(remote) {
                console.log("found url " + remote.url());
                gitUrl = remote.url();
                CheckGitInfo(name, done);
            });
            NodeGit.Diff.treeToWorkdir(repo).then(function(diff) {
                // Use diff
                console.log("num deltas "+ diff.numDeltas());
                checkin = "true";
                CheckGitInfo(name, done);
            });
            
        }, function (reasonForFailure) {
            grunt.fatal([reasonForFailure].join('\n'));
            
        function CheckGitInfo(name, callback){
            if(gitUrl !== "" && gitBranchName !== ""  && checkin !== ""){
                RemoteServerGitUpdate(name, gitUrl, gitBranchName, callback);
            }
        } 
    
        function RemoteServerGitUpdate(name, url, branchName, callback){
            
            console.log("RemoteServerGitUpdate ");
            var verbosity = conf('VERBOSITY_NPM');
            var remotePath = conf('SRV_ROOT');
            var githubUserName = conf("GITHUBID");
            var githubPW = conf("GITHUBPW");
            url = url.replace("https://", "https://" + githubUserName + ":" + githubPW + "@");
            var steps = [[
                util.format('git clone %s %s', url, remotePath),
                "echo hi"
            ],[
                util.format('(cd %s; git checkout %s)', remotePath, branchName)
            ], workflow.if_not('NPM_INSTALL_DISABLED', [
                util.format('sudo npm --prefix %s install --production --loglevel %s', remotePath, verbosity)
            ]), workflow.if_has('NPM_REBUILD', [
                'sudo npm rebuild'
            ]), [
                commands.pm2_reload(),
                commands.pm2_start(name)
            ], workflow.if_has('NGINX_ENABLED', [
                'sudo nginx -s reload'
            ])];

            workflow(steps, { name: name }, function(){
                grunt.verbose.writeln('testcallback ');
                //callback();
            });
        }
            
    });
        
       
   

   

       
    });
};
