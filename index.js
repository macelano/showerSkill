// Ref: Control Kohler DTV with Amazon Echo  
// by: Mark Celano 
//

//Load http for ajax calls
var https = require('http');

// Load the AWS SDK for Node.js
var AWS = require('aws-sdk');


//Setup Environment variables for showerUri, user1, and user2, ...
// Now set from DynamoDB based on userId
var uri = ""; //process.env.showerUri; 
var user1 = ""; //process.env.user1;
var user2 = ""; //process.env.user2;
var user3 = ""; //process.env.user3;
var user4 = ""; //process.env.user4;
var user5 = ""; //process.env.user5;
var user6 = ""; //process.env.user6;
var devUserId = process.env.devUserId;
var homeUserId = process.env.homeUserId;

// Functions
var generateResponse;
var buildSpeechletResponse;
var getDBUserSettings;
var putDBUserSettings;
var detectUser;
var setSettings;

// Variables
var assemble = "";
var userName = "";
var endpoint = "";
var command = "";
var path = "";
var userSettings;

// Create the DynamoDB service object
var dynamodb = new AWS.DynamoDB({ apiVersion: '2018-08-11' });

exports.handler = (event, context) => {
    try {
        console.log("User SESSION", event.session.user.userId);

        // New Session
        if (event.session.new) {
            console.log("NEW SESSION");
        }
        getDBUserSettings(event.session.user.userId, event, context,
            function(event, context) {
                assemble = "";
                endpoint = "";
                command = "";
                path = "";
            
                switch (event.request.type) {
                    case "LaunchRequest":
                        // Launch Request
                        console.log("Callback: LAUNCH REQUEST");
                        context.succeed(generateResponse(buildSpeechletResponse("Ask me to do something with your Shower, such as turn on or off.", true), {}));
                        break;
                    case "IntentRequest":
                        if (event.request.intent.slots.userId) detectUser(event.request.intent.slots.userId.value, event.session.user.userId);
                        if (event.request.intent.slots.command) command = event.request.intent.slots.command.value;
            
                        // Intent Request
                        console.log("Callback: SHOWER INTENT REQUEST");
                        switch (event.request.intent.name) {
                            case "GetCommand":
                                switch (command) {
                                    case "turn on":
                                        path = '/start_user.cgi';
                                        break;
                                    case "turn off":
                                        path = '/stop_user.cgi';
                                        break;
                                }
            
                                if (path == "/start_user.cgi") {
                                    endpoint = uri + path;
            
                                    if (assemble) endpoint = uri + path + "?" + assemble;
                                    console.log("Callback: " + endpoint);
                                    var body = "";
                                    // Kohler DTV Shower: Request
                                    https.get(endpoint, (response) => {
                                        response.on('data', (chunk) => {
                                            body += chunk;
                                        });
                                        response.on('end', () => {
                                            //var data = JSON.parse(body);
                                            if (userName === ''){
                                            context.succeed(generateResponse(
                                                buildSpeechletResponse('Turning shower on', true), {}));
                                            }
                                            else {
                                            context.succeed(generateResponse(
                                                buildSpeechletResponse('Turning shower on for ' + userName, true), {}));
                                            }
                                        });
                                    });
                                }
                                else if (path == "/stop_user.cgi") {
                                    endpoint = uri + path;
            
                                    if (assemble) endpoint = uri + path + "?" + assemble;
                                    console.log("Callback: " + endpoint);
                                    var body = "";
                                    // Kohler DTV Shower: Request
                                    https.get(endpoint, (response) => {
                                        response.on('data', (chunk) => {
                                            body += chunk;
                                        });
                                        response.on('end', () => {
                                            //var data = JSON.parse(body);
                                            context.succeed(generateResponse(
                                                buildSpeechletResponse(`Turning shower off`, true), {}));
                                        });
                                    });
                                }
                                else {
                                    console.log("Callback:  no cases matched");
                                    context.succeed(generateResponse(buildSpeechletResponse(`Sorry, I didn't understand`, true), {}));
                                }
                                break;
                            default:
                                throw "Invalid intent";
                        }
                    case "SessionEndedRequest":
                        // Session Ended Request
                        console.log("Callback: SESSION ENDED REQUEST");
                        break;
                    default:
                        context.fail(`INVALID REQUEST TYPE: ${event.request.type}`);
                }
            
            }

        );
    }
    catch (error) {
        context.fail(`Exception Exprot Handler: ${error}`);
    }
};

// Helpers
buildSpeechletResponse = (outputText, shouldEndSession) => {
    return {
        outputSpeech: {
            type: "PlainText",
            text: outputText
        },
        shouldEndSession: shouldEndSession
    };
};

generateResponse = (speechletResponse, sessionAttributes) => {
    return {
        version: "1.0",
        sessionAttributes: sessionAttributes,
        response: speechletResponse
    };
};

putDBUserSettings = function(userId) {
    console.log('putDBUserSettings Function call');

    var docClient = new AWS.DynamoDB.DocumentClient();

    var param = {
        TableName: 'KohlerUser',
        Key: 'userId',
        Item: {
            'userId': userId,
            'settings': {
                "showerUri": 'http://127.0.0.1:8080/shower',
                "User1": 'mom',
                "User2": 'dad',
                "User3": 'boy',
                "User4": 'girl',
                "User5": '5',
                "User6": '6',

            }
        }
    };

    docClient.put(param, function(err, data) {
        if (err) {
            console.log("putDBUserSettings: DB Write Error", err);
        }
        else {
            console.log("putDBUserSettings: DB Write Success", data);
        }
    });
};

getDBUserSettings = function(userId, event, context, callback) {
    console.log('getDBUserSettings Function call');

    var params = {
        TableName: 'KohlerUser',
        Key: {
            'userId': { S: userId },
        },
        ProjectionExpression: 'settings'
    };

    // Call DynamoDB to read the item from the table
    dynamodb.getItem(params, function(err, data) {
        if (err) {
            console.log("getDBUserSettings: DB Read Error", err);
        }
        else {
            if (data.Item === undefined) {
                putDBUserSettings(userId);
            }
            else {
                console.log("getDBUserSettings: DB Read Success", data.Item.settings.M);
                setSettings(data.Item.settings.M, callback);
                if (callback) {
                    console.log("getDBUserSettings: Calling Callback Function");
                    callback(event, context);
                }
            }
        }
    });
};

setSettings = function(settings) {
    // console.log("setSettings: settings:", settings);
    uri   = settings.showerUri.S;
    user1 = settings.User1.S;
    user2 = settings.User2.S;
    user3 = settings.User3.S;
    user4 = settings.User4.S;
    user5 = settings.User5.S;
    user6 = settings.User6.S;
};

detectUser = function(user, userId) {
    console.log('detectUser: User: ' + user + " UserId: " + userId);
    userName = user;
    if (user == user1) {
        assemble = 'user=1';
    }
    else if (user == user2) {
        assemble = 'user=2';
    }
    else if (user == user3) {
        assemble = 'user=3';
    }
    else if (user == user4) {
        assemble = 'user=4';
    }
    else if (user == user5) {
        assemble = 'user=5';
    }
    else if (user == user6) {
        assemble = 'user=6';
    }
    else { // Default response: user == undefined || user == null
        assemble = 'user=1';
        if (userId === devUserId){
            userName = 'Development';
        } 
        else if (userId === homeUserId) {
            userName = 'Peanut';
        } 
        else {
        userName = '';
        }
        console.log("detectUser: no match setting user to " + userName);
    }
    return;
};