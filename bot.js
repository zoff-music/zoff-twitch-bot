var mongojs    = require('mongojs');
var secrets    = require('./includes.js');
var dbase	   = mongojs(secrets.mongojs, ['channels']);
var request    = require('request');
var time_regex = /P((([0-9]*\.?[0-9]*)Y)?(([0-9]*\.?[0-9]*)M)?(([0-9]*\.?[0-9]*)W)?(([0-9]*\.?[0-9]*)D)?)?(T(([0-9]*\.?[0-9]*)H)?(([0-9]*\.?[0-9]*)M)?(([0-9]*\.?[0-9]*)S)?)?/;
var daysOfWeek = new Array('Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday');
var commands   = ["time", "request", "np"];
var actions    = [fetch_now_playing];
var tmi = require("tmi.js");
var config 	   = {
	server: "irc.twitch.tv",
	port: 6667,
	botName: "zoffbot",
	channels: {"#zoffbot": "zoffbot"},
	allowed: {},
	mods: {}
};
var options = {
    options: {
        debug: false
    },
    connection: {
        reconnect: true
    },
    identity: {
        username: config.botName,
        password: secrets.password
    },
    channels: ["#zoffbot"]
};

var client = new tmi.client(options);

// Connect the client to the server..
client.connect().then(function(data) {
	join_channels();
});

client.on("whisper", function (from, userstate, message, self) {
	if(self) return;
	handleOwnChannel(userstate, message, true);
})

client.on("chat", function(channel, userstate, message, self) {
	if(self) return;
    if(channel == "#zoffbot") {
        handleOwnChannel(userstate, message, false);
    } else {
		if(message.startsWith("!request")) {
			message = message.split(" ");
			if(message.length > 1) {
				if(message[1].indexOf("soundcloud.com") > -1) {
					get_soundcloud(message[1], channel, userstate.username, add_song);
				} else if(message[1].indexOf("/") > -1) {
					if(message[1].substring(0,1) == "/") message[1] = "https://soundcloud.com" + message[1];
					else message[1] = "https://soundcloud.com/" + message[1];
					get_soundcloud(message[1], channel, userstate.username, add_song);
				} else {
					get_info(message[1], channel, userstate.username, add_song);
				}
			}
		} else if(message == "!np") {
			fetch_now_playing(channel);
		} else if(message == "!time") {
			send_time(channel);
		} else if(message.startsWith("!settime")) {
			message = message.split(" ");
			if(message.length > 1) {
				check_mod(userstate.username, channel, function(allowed) {
					if(!allowed) return;
					settime(message[1], channel);
				});
			}
		} else if(message.startsWith("!moderate")) {
			message = message.split(" ");
			if(message.length > 1) {
				check_mod(userstate.username, channel, function(allowed) {
					if(!allowed) return;
					update_moderate(message[1], channel);
				});
			}
		} else if(message.startsWith("!help")) {
			send_help(channel, message);
		} else if(message.startsWith("!allow")) {
			message = message.split(" ");
			if(message.length > 1) {
				check_mod(userstate.username, channel, function(allowed) {
					if(!allowed) return;
					allow_link(channel, message[1]);
				});
			}
		} else if(message.startsWith("!zoff") || message.startsWith("!channel")) {
			client.say(channel, "Listen directly to the channel of the streamer at: https://zoff.me/" + config.channels[channel] + " or create your own at https://zoff.me!");
		} else if(message.startsWith("!promote")) {
			//check_mod(from, channel, promote, [message.substring(9), channel], true);
		} else{
			if(isUrl(message)) {
				check_mod(userstate.username, channel, function(allowed) {
					if(allowed) return;
					block_url(channel, userstate.username);
				});
			} else{
				//console.log(from + ":" + channel + "=> " + message);
			}
		}
	}
});

function update_moderate(enabled, channel) {
	if(enabled != "on" && enabled != "off") {
		client.say(channel, "That command has to be proceeded with on or off.");
		return;
	}
	enabled = (enabled == 'on');
	dbase.channels.update({channel: channel}, {$set: {moderate: enabled}}, function(err, chan) {
		var toSay = enabled ? "Now moderating your channel, blocking/allowing urls" : "Not moderating your channel";
		client.say(channel, toSay);
	});
}

function handleOwnChannel(user, message, secure) {
    var channel = "#" + user.username;
    if(message.startsWith("!join")) {
		message	= message.split(" ");
		var zoffchannel = user.username;
		var userpass = "";
		var adminpass = "";
		zoffchannel = zoffchannel.replace("#", "");
		if(message.length > 1 && message[1] != "") {
			zoffchannel = message[1];
		}
		if(message.length > 2 && message[2] != "" && secure) {
			userpass = message[2];
		}
		if(message.length > 3 && message[3] != "" && secure) {
			adminpass = message[3];
		}

		join_channel(channel, zoffchannel, userpass, adminpass);
		if(secure) {
			client.whisper(channel, "Joined your channel!");
			return;
		}
		client.say("#zoffbot", "Joined your channel " + user.username.replace("#", ""));
	} else if(message.startsWith("!leave")) {
		client.part(channel);
		dbase.channels.remove({channel: channel});
		delete config.channels[channel];
		delete config.allowed[channel];
		delete config.mods[channel];
		if(secure) {
			client.whisper(channel, "Left your channel " + user.username.replace("#", ""));
			return;
		}
		client.say("#zoffbot", "Left your channel " + user.username.replace("#", ""));
	}
}

function addMods(channel, data) {
    config.mods[channel] = data;
}

function advertise() {
	var keys = Object.keys(config.channels);
	for(var x in keys) {
		actions[Math.floor((Math.random()*4))](keys[x]); 
	}
	setTimeout(function() {advertise();}, 420000);
}

function message_users(channel) {
	var find_todo = Math.floor((Math.random()*2));
	var messages  = ["Check out Zoff at https://zoff.me, and create your own channel!", "Listen directly to this Zoff channel at https://zoff.me/" + config.channels[channel]];
	client.say(channel, messages[find_todo]);
}

function fetch_now_playing(channel) {
	dbase.channels.find({channel: channel}, function(err, chan) {
		if(chan.length == 0) {
			client.say(channel, "Couldn't fetch now playing, are you sure there is something in the list?");
			return;
		}
		var url = "https://zoff.me/api/list/" + chan[0].zoffchannel + "/__np__";
		//var url = "http://localhost/api/list/new/__np__";
		var data = {
			uri: url,
			url: url,
			form: {
				"userpass": chan[0].userpass == "" || chan[0].userpass == undefined ? "" : chan[0].userpass,
				"adminpass": chan[0].adminpass == "" || chan[0].adminpass == undefined ? "" : chan[0].adminpass,
				"token": secrets.zoff_api_key
			},
			method: "POST",
		};

		request(data, function(err, response, body) {
			var json;
			try {
				json = JSON.parse(body);
				client.say(channel, "Now playing: \"" + json.results[0].title + "\"");
			} catch(e) {
				client.say(channel, "Couldn't fetch now playing, are you sure there is something in the list?");
			}
		});
	});
}

function block_url(channel, from) {
	dbase.channels.find({channel: channel}, function(err, docs) {
		if(docs[0].hasOwnProperty("moderate") && docs[0].moderate) {
			if(config.allowed[channel].indexOf(from) < 0) {
				client.timeout(channel, from, 1, "link");
			} else if(config.allowed[channel].indexOf(from) > -1){
				config.allowed[channel].splice(config.allowed[channel].indexOf(from), 1);
			}
		}
	});
}

function send_time(channel) {
	var date = new Date();
	var extraHours;
	var output;

	dbase.channels.find({channel: channel}, function(err, docs) {
		extraHours = docs[0].time+5;
		date.addHours(extraHours);
		output 	   = "It's " + daysOfWeek[date.getDay()] + " " + pad(date.getHours(), 2) +
		 ":" + pad(date.getMinutes(), 2) + ":" + pad(date.getSeconds(), 2) + " for " + channel.substring(1);

		client.say(channel, output);
	});
}


function promote(to_promote, channel) {

}

function allow_link(channel, allowed) {
	if(config.allowed[channel] === undefined) config.allowed[channel] = [];
	config.allowed[channel].push(allowed);
	client.say(channel, "Allowed " + allowed + " to send one link.");
}

function send_help(channel, message) {
	if(message === undefined || message == "!help") {
		client.say(channel, "To request help with any commands, please say !help COMMAND. Available commands are: " + commands.join(", "));
	} else{
		switch(message.substring(6)) {
			case "request":
				client.say(channel, "This is used to request a song. If you type !request YOUTUBE_ID (change the YOUTUBE_ID with an actual YouTube ID) or !request SOUNDCLOUD_DATA (the text after 'soundcloud(dot)com/'), you'll request a song on the Zoff channel the streamer is listening on.");
				break;
			case "np":
				client.say(channel, "This tells the currently playing song on the Zoff channel of the streamer.");
				break;
			case "settime":
				client.say(channel, "This is only for mods, and it sets the streamers timezone in GMT. Use with !settime +TIME");
				break;
			case "time":
				client.say(channel, "This tells the time of the streamer");
				break;
			case "allow":
				client.say(channel, "This is only for mods, and it allows a specific user to send one link. Use with !allow NAME");
				break;
			case "moderate":
				client.say(channel, "This is only for mods, and sets me to either moderate or not moderate url posting");
				break;
		}
	}
}

function check_mod(from, channel, callback) {
	if(config.mods[channel].indexOf(from) < 0) {
		client.mods(channel).then(function(data) {
			addMods(data[0], _data);
			if(config.mods[channel].indexOf(from) < 0) {
				callback(false);
			} else {
				callback(true);
			}
		}).catch(function(err) {
			callback(false);
		});
	} else {
		callback(true);
	}
}

function join_channels() {
	dbase.channels.find({}, function(err, docs) {
		for(var x in docs) {
			var channel 	= docs[x].channel;
			var zoffchannel = docs[x].zoffchannel;

			config.channels[channel] = zoffchannel;
			join(channel);
		}
		//socket.emit("add", ["123asd", "superteit", "", '123', "electro"]);
	});
}

function join(channel) {
    client.join(channel).then(function(data) {
        client.mods(data[0]).then(function(_data) {
			addMods(data[0], _data);
        });
    });
}

function settime(time_from, channel) {
	var time = parseFloat(time_from);
	var add  = "";
	if(isNaN(time)) client.say(channel, "\"" + time_from + "\" isn't a number.. Try again");
	else{
		if(time > 0) add = "+";
		client.say(channel, channel.substring(1) + "s timezone has been changed to GMT" + add + time);
		dbase.channels.update({channel: channel}, {$set:{time: time}});
	}
}

function join_channel(channel, zoff_channel, userpass, adminpass) {
	config.channels[channel] = zoff_channel;
	dbase.channels.update({channel: channel}, {
		channel: channel,
		zoffchannel: zoff_channel,
		time:0,
		userpass: userpass,
		adminpass: adminpass
	}, {upsert: true}, function(err, docs) {
		join(channel);
	});
}

function get_soundcloud(id, twitch_channel, requester, callback) {
	dbase.channels.find({channel: twitch_channel}, function(err, chan) {
		if(chan.length > 0) {
			request("http://api.soundcloud.com/resolve/?url=" + id + "&limit=1&client_id=" + secrets.scKey + "&format=json&_status_code_map[200]=200", function (err, response, body) {
				try {
					var song = JSON.parse(body);
					var duration=Math.floor(song.duration / 1000);
	                var secs = duration;
					var title=song.title;
	                if(title.indexOf(song.user.username) == -1) {
	                    title = song.user.username +  " - " + title;
	                }
	                var id=song.id;
	                var thumb=song.artwork_url;
	                if(thumb == null) thumb = song.waveform_url;
					else thumb = thumb.replace("-large.jpg", "-t500x500.jpg");
					callback({id: id, title: title, duration: duration, source: "soundcloud", thumbnail: thumb}, chan[0], twitch_channel, requester);
				} catch(e) {
					client.say(twitch_channel, "Couldn't add song, sure the channel is set-up?");
				}
			});
		}
	});
}

function get_info(id, twitch_channel, requester, callback) {
	dbase.channels.find({channel: twitch_channel}, function(err, chan) {
		if(chan.length > 0) {
			request("https://www.googleapis.com/youtube/v3/videos?id="+id+"&part=contentDetails,snippet,id&key=" + secrets.key, function (err, response, body) {
				try {
					object 	 = JSON.parse(body);
					object 	 = object.items[0];
					title 	 = object.snippet.title;
					duration = object.contentDetails.duration;
					duration = durationToSeconds(duration);
					callback({id: id, title: title, duration: duration, source: "youtube"}, chan[0], twitch_channel, requester);
				} catch(e) {
					client.say(twitch_channel, "Couldn't add song, sure the channel is set-up?");
				}
			});
		}
	});
}

function add_song(song_info, channel, twitch_channel, requester) {
	var userpass = "";
	if(channel.userpass) {
		userpass = channel.userpass;
	}
	var adminpass = "";
	if(channel.adminpass) {
		adminpass = channel.adminpass;
	}
	var url = "https://zoff.me/api/list/" + channel.zoffchannel + "/" + song_info.id;
	var addObject = {
		"title": song_info.title,
		"duration": song_info.duration,
		"end_time": song_info.duration,
		"start_time": 0,
		"adminpass": adminpass,
		"userpass": userpass,
		"token": secrets.zoff_api_key,
		"source": song_info.source,
	};
	if(song_info.source == "soundcloud") addObject.thumbnail = song_info.thumbnail;
	var data = {
		uri: url,
		url: url,
		form: addObject,
		method: "POST",
	};
	request(data, function(err, response, body) {
		var json = JSON.parse(body);
		if(json.status == 200) {
			client.say(twitch_channel, requester + " added \"" + song_info.title + "\"");
		} else if(json.status == 403) {
			client.say(twitch_channel, requester + " suggested \"" + song_info.title + "\". It needs an admin to accept it to be valid.");
		} else if(json.status == 409) {
			addObject = {
				adminpass: "",
				start_time: 0,
				end_time: song_info.duration,
				duration: song_info.duration,
				title: song_info.title,
				userpass: userpass,
				"token": secrets.zoff_api_key,
				"source": "source"
			};
			if(addObject.source == "source") addObject.thumbnail = song_info.thumbnail;
			request.put({url: "https://zoff.me/api/list/" + channel.zoffchannel + "/" + song_info.id, form: addObject}, function(err, response, body) {
				if(json.status == 200) {
					client.say(twitch_channel, requester + " voted on \"" + song_info.title + "\", since it is already in the list.");
				} else {
					client.say(twitch_channel, "Couldn't add song, sure the channel is set-up?");
				}
			});
		} else {
			client.say(twitch_channel, "Couldn't add song, sure the channel is set-up?");
		}
	})
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
	if(a === undefined) return false;
    var i = a.length;
    while (i--) {
        if (a[i] === obj) {
            return true;
        }
    }
    return false;
}

function remove_from_array(array, element) {
    if(contains(array, element)) {
        var index = array.indexOf(element);
        if(index != -1)
            array.splice(index, 1);
    }
}

function pad(t, num) {
	if(num == 2) out = t < 10 ? "0"+t : t;
	else if(num == 3) out = t < 10 ? "00"+t : t < 100 ? "0"+t : t;
	return out;
}

Date.prototype.addHours = function(h) {
 	this.setTime(this.getTime() + (h*60*60*1000));
 	return this;
};

String.prototype.startsWith = function(searchString, position) {
    position = position || 0;
    return this.indexOf(searchString, position) === position;
};
