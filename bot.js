var irc 	   = require('irc');
var mongojs    = require('mongojs');
var dbase	   = mongojs('zoffbot', ['channels'])
var io 		   = require('socket.io-client');
var request    = require('request');
var time_regex = /P((([0-9]*\.?[0-9]*)Y)?(([0-9]*\.?[0-9]*)M)?(([0-9]*\.?[0-9]*)W)?(([0-9]*\.?[0-9]*)D)?)?(T(([0-9]*\.?[0-9]*)H)?(([0-9]*\.?[0-9]*)M)?(([0-9]*\.?[0-9]*)S)?)?/
var secrets    = require('./includes.js');
var daysOfWeek = new Array('Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday');
var commands   = ["time", "settime", "request", "np"];

var config 	= {
	server: "irc.twitch.tv",
	port: 6667,
	botName: "zoffbot",
	channels: {},
	allowed: {},
	mods: {}
};

var client = new irc.Client(config.server, config.botName,
	{password: secrets.password}
);

var connection_options = {
	'sync disconnect on unload':true,
	'secure': true
};

var socket = io.connect('https://zoff.no:8880', connection_options);

socket.on("connect", function(){
	//socket.emit("list", "electro");
	//console.log("connected");
});

client.addListener("raw", function(message){
	//console.log(message);
});

client.addListener('registered', function(message){
	if(message.rawCommand == 001){
		join_channels();
	}

})

client.addListener("join", function(channel, who){
	//console.log(channel, who);
});

client.addListener("message", function(from, to, message){
	if(to == "#zoffbot") return;
	else if(message.startsWith("!request")){
		
		get_info(message.substring(9), config.channels[to], add_song);

	}else if(message == "!np"){
		socket.emit('now_playing', config.channels[to], function(title){
			client.say(to, title);
		});
	}else if(message == "!time"){
		send_time(to);
	}else if(message.startsWith("!settime")){
		check_mod(from, to, settime, [message.substring(9), to], true);
	}else if(message.startsWith("!help")){
		send_help(to, message);
	}else if(message.startsWith("!allow")){
		check_mod(from, to, allow_link, [to, message.substring(7)], true);
	}else{
		if(isUrl(message)){
			check_mod(from, to, block_url, [to, from], true);
		}else{
			//console.log(from + ":" + to + "=> " + message);
		}
	}
});

client.addListener("message#zoffbot", function(from, message){
	var channel 	= "#" + from;
	if(message.startsWith("!join")){
		var length 		= message.length;
		var zoffchannel = from;

		if(length > 6){
			zoffchannel = message.substring(6);
		}

		join_channel(channel, zoffchannel);
	}else if(message.startsWith("!leave")){
		client.part(channel);
		dbase.channels.remove({channel: channel});
		delete config.channels[channel];
	}
});

function block_url(channel, from){
	if(!contains(config.allowed[channel], from)){
		client.say(channel, ".timeout " + from + " 1");
	}else if(contains(config.allowed[channel], from)){
		remove_from_array(config.allowed[channel], from);
	}
}

function send_time(channel){
	var date = new Date();
	var extraHours;
	var output;

	dbase.channels.find({channel: channel}, function(err, docs){
		extraHours = docs[0].time+5;
		date.addHours(extraHours);
		output 	   = "It's " + daysOfWeek[date.getDay()] + " " + date.getHours() +
		 ":" + date.getMinutes() + ":" + date.getSeconds() + " for " + channel.substring(1);

		client.say(channel, output);
	});
}

function allow_link(channel, allowed){
	if(config.allowed[channel] == undefined) config.allowed[channel] = [];
	config.allowed[channel].push(allowed);
	client.say(channel, "Allowed " + allowed + " to send one link.");
}

function send_help(channel, message){
	if(message == "!help"){
		client.say(channel, "To request help with any commands, please say !help COMMAND. Available commands are: " + commands);
	}else{
		switch(message.substring(6)){
			case "request":
				client.say(channel, "This is used to request a song. If you type !request YOUTUBE_ID (change the YOUTUBE_ID with an actual YouTube ID), you'll request a song on the Zöff channel the streamer is listening on!");
				break;
			case "np":
				client.say(channel, "This 'forces' me to tell you the currently playing song on the Zöff channel the streamer is listening on!");
				break;
			case "settime":
				client.say(channel, "This is only for mods, and it sets the streamers timezone in GMT");
				break;
			case "time":
				client.say(channel, "This 'forces' me to tell you what the time is where the streamer lives.")
				break;
			case "allow":
				client.say(channel, "This is only for mods, and it allows a specific user to send one link.");
				break;
		}
	}
}

function check_mod(from, channel, command, args, normal){
	if(config.mods[channel] == undefined){
		var mods = [];
		channel  = channel.substring(1);
		request("http://tmi.twitch.tv/group/user/" + channel + "/chatters", function (err, response, body) {
			mods = (JSON.parse(body)).chatters.moderators;
			config.mods["#" + channel] = mods;
			if(contains(mods, from) == normal) command(args[0], args[1])
		});
	}else{
		if(contains(config.mods[channel], from)) command(args[0], args[1]);
	}
}

function join_channels(){
	dbase.channels.find({}, function(err, docs){
		for(x in docs){
			var channel 	= docs[x].channel;
			var zoffchannel = docs[x].zoffchannel;

			config.channels[channel] = zoffchannel;
			client.join(channel);
			join_and_change(zoffchannel);
		}
		//socket.emit("add", ["123asd", "superteit", "", '123', "electro"]);
	});
}

function settime(time_from, channel){
	var time = parseFloat(time_from);
	var add  = "";
	if(isNaN(time)) client.say(channel, "\"" + time_from + "\" isn't a number.. Try again");
	else{
		if(time > 0) add = "+";
		client.say(channel, channel.substring(1) + "s timezone has been changed to GMT" + add + time);
		dbase.channels.update({channel: channel}, {$set:{time: time}});
	}
}

function join_channel(channel, zoff_channel){
	if(zoff_channel == undefined) zoff_channel = channel.substring(1);

	config.channels[channel] = zoff_channel;
	dbase.channels.update({channel: channel}, {channel: channel, zoffchannel: zoff_channel, time:0}, {upsert: true});
	join_and_change(zoff_channel);
}

function get_info(id, channel, callback){
	request("https://www.googleapis.com/youtube/v3/videos?id="+id+"&part=contentDetails,snippet,id&key=" + secrets.key, function (err, response, body) {
		object 	 = JSON.parse(body);
		object 	 = object["items"][0];
		title 	 = object["snippet"]["title"];
		duration = object["contentDetails"]["duration"]
		duration = durationToSeconds(duration);

		callback({id: id, title: title, duration: duration}, channel);
	});
}

function add_song(song_info, channel){
	socket.emit("add", [song_info.id, song_info.title, "", song_info.duration, channel]);
	socket.emit("change_channel");
}

function join_and_change(zoffchannel){
	socket.emit("list", zoffchannel);
	socket.emit("change_channel");
}

function durationToSeconds(duration) {
    var matches = duration.match(time_regex);
    var hours 	= parseInt(matches[12])||0;
    var minutes = parseInt(matches[14])||0;
    var seconds = parseInt(matches[16])||0;

    return hours * 60 * 60 + minutes * 60 + seconds;
}

function isUrl(str) {
 	var pattern = new RegExp("\\b(((ht|f)tp(s?)\\:\\/\\/|~\\/|\\/)|www.)" + 
    	"(\\w+:\\w+@)?(([-\\w]+\\.)+(com|org|net|gov" + 
    	"|mil|biz|info|mobi|name|aero|jobs|museum" + 
    	"|travel|[a-z]{2}))(:[\\d]{1,5})?" + 
		"(((\\/([-\\w~!$+|.,=]|%[a-f\\d]{2})+)+|\\/)+|\\?|#)?" + 
		"((\\?([-\\w~!$+|.,*:]|%[a-f\\d{2}])+=?" + 
		"([-\\w~!$+|.,*:=]|%[a-f\\d]{2})*)" + 
		"(&(?:[-\\w~!$+|.,*:]|%[a-f\\d{2}])+=?" + 
		"([-\\w~!$+|.,*:=]|%[a-f\\d]{2})*)*)*" + 
		"(#([-\\w~!$+|.,*:=]|%[a-f\\d]{2})*)?\\b");
  	if(!pattern.test(str)) {
    	return false;
  	} else {
    	return true;
  	}
}

function contains(a, obj) {
	if(a == undefined) return false;
    var i = a.length;
    while (i--) {
        if (a[i] === obj) {
            return true;
        }
    }
    return false;
}   

function remove_from_array(array, element){
    if(contains(array, element)){
        var index = array.indexOf(element);
        if(index != -1)
            array.splice(index, 1);
    }
}

/*
Object.prototype.contains_element = function(element){
	var i = this.length;
	while(i--) {
		if(this[i] === element){
			return true;
		}
	}
	return false;
}
*/

Date.prototype.addHours = function(h) {    
 	this.setTime(this.getTime() + (h*60*60*1000)); 
 	return this;   
}

String.prototype.startsWith = function(searchString, position) {
    position = position || 0;
    return this.indexOf(searchString, position) === position;
};