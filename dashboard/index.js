/* eslint-disable */
"use strict";

var blessed = require("blessed");

var formatOutput = require("../utils/format-output.js");
var formatModules = require("../utils/format-modules.js");
var formatAssets = require("../utils/format-assets.js");


require('colors');

const bg = 'red';
const os = require('os');
const ifaces = os.networkInterfaces();
const ngrok = require('ngrok');
const port = process.env.PORT || 8080;
const getIP = new Promise(function (resolve) {
    Object.keys(ifaces).forEach(function (ifname) {
        var alias = 0;

        ifaces[ifname].forEach(function (iface) {
            if ('IPv4' !== iface.family || iface.internal !== false) {
                // skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
                return;
            }
            if (ifname == 'en0') {
                resolve('http://' + iface.address);
            }
        });
        // resolve();
    });
});
var ip1 = '';
var ip2 = '';
var ip3 = '';
var style = {
    fillCellBorders: false
};

var status = "";
var progress = "";
var operation = '';
var dash = null;
var padding = 0;

var updateStatus = function () {
    var op  = '{bold}Operation: {/}' + operation;
    var stat= '{bold}Status:    {/}' + status;
    dash.status.setContent(stat + '\n' + op);
};

function Dashboard (options) {
    dash = this;
    this.color = options && options.color || "green";
    this.minimal = options && options.minimal || false;
    this.setData = this.setData.bind(this);

    this.screen = blessed.screen({
        smartCSR: true,
        style: style,
        title: "webpack-dashboard",
        dockBorders: false,
        fullUnicode: true,
    });

    this.layoutLog.call(this);
    this.layoutStatus.call(this);
    !this.minimal && this.layoutModules.call(this);
    !this.minimal && this.layoutAssets.call(this);

    this.screen.key(["escape", "q", "C-c"], function () {
        process.exit(0);
    });


    ngrok.connect(port, function (innerErr, url) {
        if (innerErr) {
            return console.log(innerErr);
        }
        getIP
            .then(function (res) {
                ip1 = (url).bold.blue;
                ip2 = ('http://localhost:' + port).bold.green;
                ip3 = (res + ':' + port).bold.grey;
                this.ips.log(ip1 + '\n' + ip2 + '\n' + ip3 + '{/}')
            }.bind(this));
    }.bind(this));

    updateStatus();
    this.screen.render();
}

Dashboard.prototype.setData = function (dataArr) {
    var self = this;

    dataArr.forEach(function (data) {
        switch (data.type) {
            case "progress": {
                var percent = parseInt(data.value * 100);
                if (self.minimal) {
                    percent && self.progress.setContent(percent.toString() + "%");
                } else {
                    percent && self.progressbar.setContent(percent.toString() + "%");
                    progress = "{orange-fg}{bold}" + percent + "{/}";
                    updateStatus();
                }
                break;
            }
            case "operations": {
                operation = data.value;
                switch (data.value) {
                    case 'idle': {
                        operation = "{green-fg}{bold}Idle{/}";
                    }
                    default: {
                        operation = "{grey-fg}{bold}" + data.value + "{/}";
                    }
                }
                updateStatus();
                break;
            }
            case "status": {
                var content;

                switch (data.value) {
                    case "Success":
                        content = "{green-fg}{bold}" + data.value + "{/}";
                        operation = "{green-fg}{bold}Idle{/}";
                        break;
                    case "Failed":
                        content = "{red-fg}{bold}" + data.value + "{/}";
                        break;
                    default:
                        content = "{bold}" + data.value + "{/}";
                }
                status = content;
                updateStatus();
                break;
            }
            case "stats": {
                var stats = {
                    hasErrors: function () {
                        return data.value.errors;
                    },
                    hasWarnings: function () {
                        return data.value.warnings;
                    },
                    toJson: function () {
                        return data.value.data;
                    }
                };
                if (stats.hasErrors()) {
                    status = "{red-fg}{bold}Failed{/}";
                    updateStatus();
                }
                self.logText.log(formatOutput(stats));
                !self.minimal && self.moduleTable.setData(formatModules(stats));
                !self.minimal && self.assetTable.setData(formatAssets(stats));
                break;
            }
            case "log": {
                self.logText.log(data.value);
                break;
            }
            case "clear": {
                self.logText.setContent("");
                break;
            }
        }
    });

    this.screen.render();
};

Dashboard.prototype.layoutLog = function () {
    this.log = blessed.box({
        label: "Log",
        width: this.minimal ? "100%" : "75%",
        height: this.minimal ? "80%" : "42%",
        left: "0%",
        top: "0%",
        border: {
            type: "line",
        },
        style: style
    });

    this.logText = blessed.log({
        parent: this.log,
        tags: true,
        width: "100%-5",
        scrollable: true,
        input: true,
        alwaysScroll: true,
        scrollbar: {
            ch: " ",
            inverse: true
        },
        keys: true,
        vi: true,
        mouse: true,
        style: style
    });

    this.screen.append(this.log);
};

Dashboard.prototype.layoutModules = function () {
    this.modules = blessed.box({
        label: "Modules",
        tags: true,
        width: "50%",
        height: "58%",
        left: "0%",
        top: "42%",
        border: {
            type: "line",
        },
        style: style,
    });

    this.moduleTable = blessed.table({
        fillCellBorders: true,
        parent: this.modules,
        style: style,
        height: "100%",
        width: "100%-5",
        align: "left",
        pad: 1,
        shrink: true,
        scrollable: true,
        alwaysScroll: true,
        scrollbar: {
            ch: " ",
            inverse: true
        },
        keys: true,
        vi: true,
        mouse: true,
        data: [["Name", "Size", "Percentage"]]
    });

    this.screen.append(this.modules);
};

Dashboard.prototype.layoutAssets = function () {
    this.assets = blessed.box({
        label: "Assets",
        tags: true,
        padding: padding,
        width: "50%",
        height: "58%",
        left: "50%",
        top: "42%",
        border: {
            type: "line",
        },
        style: style
    });

    this.assetTable = blessed.table({
        parent: this.assets,
        style: style,
        height: "100%",
        width: "100%-5",
        align: "left",
        pad: 1,
        scrollable: true,
        alwaysScroll: true,
        scrollbar: {
            ch: " ",
            inverse: true
        },
        keys: true,
        vi: true,
        mouse: true,
        data: [["Name", "Size"]]
    });

    this.screen.append(this.assets);
};

Dashboard.prototype.layoutStatus = function () {

    this.wrapper = blessed.layout({
        width: this.minimal ? "100%" : "33%",
        height: this.minimal ? "20%" : "42%",
        top: this.minimal ? "80%" : "0%",
        left: this.minimal ? "0%" : "75%",
        layout: "grid",
        style: style
    });

    this.operations = blessed.box({
        parent: this.wrapper,
        label: "Operation",
        tags: true,
        padding: padding,
        width: this.minimal ? "0%" : "100%",
        height: this.minimal ? "100%" : "34%",
        valign: "middle",
        border: {
            type: "line",
        },
        style: style,
    });

    this.ipBox = blessed.box({
        parent: this.wrapper,
        label: "Network",
        tags: true,
        padding: padding,
        width: this.minimal ? "50%" : "100%",
        height: this.minimal ? "100%" : "34%",
        valign: "middle",
        border: {
            type: "line",
        },
        style: style,
    });

    this.status = blessed.box({
        parent: this.wrapper,
        label: "Information",
        tags: true,
        padding: padding,
        width: this.minimal ? "50%" : "100%",
        height: this.minimal ? "100%" : "34%",
        border: {
            type: "line",
        },
        style: style,
    });

    this.progress = blessed.box({
        parent: this.wrapper,
        label: "Progress",
        tags: true,
        padding: padding,
        width: this.minimal ? "0%" : "100%",
        height: this.minimal ? "100%" : "34%",
        valign: "middle",
        border: {
            type: "line",
        },
        style: style,
    });


    this.ips = blessed.log({
        parent: this.ipBox,
        tags: true,
        width: "100%-5",
        scrollable: true,
        alwaysScroll: true,
        scrollbar: {
            ch: " ",
            inverse: true
        },
        style: style,
    });

    this.progressbar = blessed.ProgressBar({
        parent: this.progress,
        height: 1,
        width: "90%",
        top: "center",
        left: "center",
        hidden: this.minimal,
        orientation: "horizontal",
        style: style
    });

    this.screen.append(this.wrapper);
};

module.exports = Dashboard;
