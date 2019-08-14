window.addEventListener("load", function() {
  document
    .getElementById("save-data-button")
    .addEventListener("click", submitData);

  document
    .getElementById("delete-data-button")
    .addEventListener("click", deleteData);

  document.getElementById("adminpass").addEventListener("change", function() {
    dirtyFields.adminpass = true;
  });
  document.getElementById("userpass").addEventListener("change", function() {
    dirtyFields.userpass = true;
  });
  document.getElementById("time").addEventListener("change", function() {
    dirtyFields.time = true;
  });
  document.getElementById("zoffchannel").addEventListener("change", function() {
    dirtyFields.zoffchannel = true;
  });
});

var dirtyFields = {
  adminpass: false,
  userpass: false,
  time: false,
  zoffchannel: false
};

function deleteData() {
  Helper.ajax({
    method: "POST",
    url: "/delete",
    headers: {
      "Content-Type": "application/json"
    },
    success: function(response) {
      var response = JSON.parse(response);
      if (!response.error) {
        M.toast({
          html: "Deleted channel.",
          displayLength: 4000,
          classes: "green lighten"
        });
      } else {
        M.toast({
          html: "Something went wrong when deleting, please try again later.",
          displayLength: 4000,
          classes: "red lighten"
        });
      }
    },
    error: function(response) {
      var response = JSON.parse(response);
      M.toast({
        html: "Something went wrong when deleting, please try again later.",
        displayLength: 4000,
        classes: "red lighten"
      });
    }
  });
}

function submitData() {
  var sendObject = {};
  if (dirtyFields.adminpass) {
    sendObject.adminpass = document.getElementById("adminpass").value;
  }
  if (dirtyFields.userpass) {
    sendObject.userpass = document.getElementById("userpass").value;
  }
  if (dirtyFields.zoffchannel) {
    sendObject.zoffchannel = document.getElementById("zoffchannel").value;
  }
  if (dirtyFields.time) {
    sendObject.time = document.getElementById("time").value;
  }
  console.log("sending", { saveObject: sendObject });
  Helper.ajax({
    method: "POST",
    url: "/save",
    headers: {
      "Content-Type": "application/json"
    },
    data: { saveObject: sendObject },
    success: function(response) {
      var response = JSON.parse(response);
      if (!response.error) {
        M.toast({
          html: "Saved settings.",
          displayLength: 4000,
          classes: "green lighten"
        });
      } else {
        M.toast({
          html: "Something went wrong when saving, please try again later.",
          displayLength: 4000,
          classes: "red lighten"
        });
      }
    },
    error: function(response) {
      var response = JSON.parse(response);
      M.toast({
        html: "Something went wrong when saving, please try again later.",
        displayLength: 4000,
        classes: "red lighten"
      });
    }
  });
}

var Helper = {
  ajax: function(obj) {
    var _async = true;
    if (obj.async) _async = obj.async;
    if (obj.method == undefined && obj.type != undefined) obj.method = obj.type;
    if (obj.method == undefined) obj.method = "GET";
    var xmlhttp = new XMLHttpRequest();
    xmlhttp.onreadystatechange = function() {
      if (xmlhttp.readyState == XMLHttpRequest.DONE) {
        // XMLHttpRequest.DONE == 4
        if (
          xmlhttp.status == 200 ||
          xmlhttp.status == 201 ||
          xmlhttp.status == 202
        ) {
          obj.success(xmlhttp.responseText, xmlhttp);
        } else if (obj.hasOwnProperty("error")) {
          obj.error(xmlhttp);
        }
      }
    };

    xmlhttp.open(obj.method, obj.url, _async);
    if (obj.headers) {
      for (header in obj.headers) {
        xmlhttp.setRequestHeader(header, obj.headers[header]);
      }
    }
    if (obj.data) {
      if (typeof obj.data == "object") obj.data = JSON.stringify(obj.data);
      //xmlhttp.send(sendRequest);
      console.log(obj.data);
      xmlhttp.send(obj.data);
    } else xmlhttp.send();
  }
};
