var irc 	   = require('irc');
var mongojs    = require('mongojs');
var dbase	   = mongojs('zoffbot', ['channels'])
var io 		   = require('socket.io-client');
var request    = require('request');
var time_regex = /P((([0-9]*\.?[0-9]*)Y)?(([0-9]*\.?[0-9]*)M)?(([0-9]*\.?[0-9]*)W)?(([0-9]*\.?[0-9]*)D)?)?(T(([0-9]*\.?[0-9]*)H)?(([0-9]*\.?[0-9]*)M)?(([0-9]*\.?[0-9]*)S)?)?/
var secrets   = require('./includes.js');

var config 	= {
	server: "irc.twitch.tv",
	port: 6667,
	botName: "zoffbot",
	channels: {}
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
	console.log("connected");
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

	}else{
		console.log(from + " => " + to + ": " + message);
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
		client.leave(channel);
		dbase.channels.remove({channel: channel});
		delete config.channels[channel];
	}
});

function join_channels(){
	dbase.channels.find({}, function(err, docs){
		for(x in docs){
			var channel 	= docs[x].channel;
			var zoffchannel = docs[x].zoffchannel;

			config.channels[channel] = zoffchannel;
			console.log("Joined channel: " + channel)
			client.join(channel);
			join_and_change(zoffchannel);
		}
		//socket.emit("add", ["123asd", "superteit", "", '123', "electro"]);
	});
}

function join_channel(channel, zoff_channel){
	if(zoff_channel == undefined) zoff_channel = channel.substring(1);

	config.channels[channel] = zoff_channel;
	dbase.channels.update({channel: channel}, {channel: channel, zoffchannel: zoff_channel}, {upsert: true});
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


String.prototype.startsWith = function(searchString, position) {
    position = position || 0;
    return this.indexOf(searchString, position) === position;
};