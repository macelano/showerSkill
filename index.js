// Ref: Control Kohler DTV with Amazon Echo  
// by: Mark Celano 

//Load http for ajax calls
var https = require('http');

// Load the AWS SDK for Node.js
var AWS = require('aws-sdk');

//Setup Environment variables for showerUri, user1, and user2, ...
//These will be set from DynamoDB based on userId
var defaultUri = "http://127.0.0.1/shower";
var uri = ""; //process.env.showerUri; 
var user1 = "", user2 = "", user3 = "", user4 = "", user5 = "", user6 = ""; 

//Special variables for custom response
var devUserId = process.env.devUserId;
var homeUserId = process.env.homeUserId;

//Other Variables
var userName = "";      // used name in reponse (Example:  Mark, Kim, etc.)
var command = "";       // Intent Command
var speachlet = "";     // Speachlet respose returned through Alexa

var endpoint = "";      // uri and path (Example: http://71.205.88.49:8080 + /shower)
var path = "";          // shower CGI function call (Example: /start_user.cgi)
var queryParams = "";   // queryParams

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
            //Callback function:  Process Response
            function(event, context) {
                queryParams = "";
                endpoint = "";
                command = "";
                path = "";
            
                console.log("Event Type: " + event.request.type);
                
                switch (event.request.type) {
                    case "LaunchRequest":
                        // Launch Request
                        console.log("Callback: LAUNCH REQUEST");
                        if (uri == defaultUri){
                            context.succeed(generateResponse(buildSpeechletResponse("Your Shower must be configured, including configuring port forwarding to your Kohler DTV Plus System Controller Module.  Please contact the developer to have skill configured for your implementation.", true), {}));
                        } else {
                            context.succeed(generateResponse(buildSpeechletResponse("Ask me to do something with your Shower, such as turn on or off.", true), {}));
                        }
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
                                        if (userName === ''){
                                            speachlet = "Turning Shower on"
                                        } else {
                                            speachlet = "Turning Shower on for " + userName;
                                        }
                                        break;
                                    case "turn off":
                                        path = '/stop_user.cgi';
                                        speachlet = "Turning Shower off"
                                        break;
                                    default:
                                        path = '';
                                        speachlet = "Sorry, I didn't understand your request."
                            }
            
                            endpoint = uri + path;
                            if (queryParams) endpoint = uri + path + "?" + queryParams;
                            console.log("Callback: " + endpoint);
                            
                            if (path === ''){
                                console.log("Callback:  no cases matched");
                                context.succeed(generateResponse(buildSpeechletResponse(speachlet, true), {}));
                            } else {
                                var body = "";
                                // Kohler DTV Shower: Request
                                https.get(endpoint, (response) => {
                                    console.log('statusCode:', response.statusCode);
                                    console.log('headers:', response.headers);

                                    response.on('data', (chunk) => {
                                        body += chunk;
                                    });
                                    
                                    response.on('end', () => {
                                        context.succeed(generateResponse(
                                            buildSpeechletResponse(speachlet, true), {}));
                                    });
                                }).on('error', (e) => {
                                    console.error(`Callback: Error: ${e.message}`);
                                    generateResponse(buildSpeechletResponse('Failed ' + speachlet + ' ' + e.message, true), {});
                                });
                            }
                        }
                    case "SessionEndedRequest":
                        // Session Ended Request
                        console.log("Callback: SESSION ENDED REQUEST");
                        break;
                    default:
                        console.log("Callback: DEFAULT Case");
                        context.fail(`INVALID REQUEST TYPE: ${event.request.type}`);
                }
            
            }

        );
    }
    catch (error) {
        console.log("Callback: Catch" + error);
        context.fail(`Exception Export Handler: ${error}`);
    }
};

// Helpers
var buildSpeechletResponse = (outputText, shouldEndSession) => {
    return {
        outputSpeech: {
            type: "PlainText",
            text: outputText
        },
        shouldEndSession: shouldEndSession
    };
};

var generateResponse = (speechletResponse, sessionAttributes) => {
    return {
        version: "1.0",
        sessionAttributes: sessionAttributes,
        response: speechletResponse
    };
};

//Setup default Settings into Dynamo DB (key: userId)
var putDBUserSettings = function(userId) {
    console.log('putDBUserSettings Function call');

    var docClient = new AWS.DynamoDB.DocumentClient();

    var param = {
        TableName: 'KohlerUser',
        Key: 'userId',
        Item: {
            'userId': userId,
            'settings': {
                "showerUri": defaultUri,
                "User1": 'one',
                "User2": 'two',
                "User3": 'three',
                "User4": 'four',
                "User5": 'five',
                "User6": 'six'
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

//Get User Settings from Dynamo DB (key: userId)
var getDBUserSettings = function(userId, event, context, callback) {
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
            }
            if (callback) {
                console.log("getDBUserSettings: Calling Callback Function");
                callback(event, context);
            }
        }
    });
};

//Set Setting out of DB setting object
var setSettings = function(settings) {
    uri   = settings.showerUri.S;
    user1 = settings.User1.S;
    user2 = settings.User2.S;
    user3 = settings.User3.S;
    user4 = settings.User4.S;
    user5 = settings.User5.S;
    user6 = settings.User6.S;
};

//Set userName and queryParams based on userId
var detectUser = function(user, userId) {
    console.log('detectUser: User: ' + user + " UserId: " + userId);
    userName = user;
    if (user == user1) {
        queryParams = 'user=1';
    }
    else if (user == user2) {
        queryParams = 'user=2';
    }
    else if (user == user3) {
        queryParams = 'user=3';
    }
    else if (user == user4) {
        queryParams = 'user=4';
    }
    else if (user == user5) {
        queryParams = 'user=5';
    }
    else if (user == user6) {
        queryParams = 'user=6';
    }
    else { // Default response: user == undefined || user == null
        queryParams = 'user=1';
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
