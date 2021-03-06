var Router = function(mappedEndpoints) {
    var logger  = require("./../../logging/logger").makeLogger("ROUTER---------");
    var fs      = require("fs");
    var mime    = require("mime");
    var path    = require('path');

    //Configuration.
    var config  = require("../../../resources/config").getInstance();

    //Private variables.
    var handles     = mappedEndpoints;
    var pathParts   = process.argv[1].split(/([/\\])/);
    var rootFolder  = pathParts.splice(0, (pathParts.length - 3)).join("");

    /*-------------------------------------------------------------------------------------------------
     * ------------------------------------------------------------------------------------------------
     *                                        Public functions
     * ------------------------------------------------------------------------------------------------
     ------------------------------------------------------------------------------------------------*/
    /**
     * Routes the given request according to the given parameters.
     * Will try and serve a static file or execute a rest endpoint.
     *
     * @param pathName The requested URI (can be a rest-endpoint/folder/file).
     * @param request The request as sent by the client.
     * @param response The response to write to.
     */
    this.route = function route(pathName, request, response) {
        if(isFile(pathName)) {
            //All files on the static file server should be located in the www folder!
            var fullPath = path.normalize(rootFolder + "/" + config.settings.webContentFolder + pathName);
            tryAndServeFile(response, fullPath);
        } else {
            if(pathName.length > 1 && pathName.substring(pathName.length - 1) === "/") {
                displayError(response, 403, "Folder access is forbidden!", pathName);
            } else {
                //Handle REST endpoint access.
                tryAndHandleRestEndpoint(handles, pathName, request, response)
            }
        }
    };

    /*-------------------------------------------------------------------------------------------------
     * ------------------------------------------------------------------------------------------------
     *                                        Private functions
     * ------------------------------------------------------------------------------------------------
     ------------------------------------------------------------------------------------------------*/
    /**
     * Returns true if the resource is a file, false if not.
     *
     * @param pathName The path to the file, including the file and extention.
     * @returns {boolean} True if a file, false if not.
     */
    function isFile (pathName) {
        var path = pathName.replace("/","");
        var isFile = path.indexOf(".") > -1;
        return isFile && path.search(".") == 0;
    }

    /**
     * Tries to serve the requested resource.
     * Will check if the resource exists, if not a 404 will be generated.
     * If the resource cannot be read or returned a 500 will be generated.
     * Will set the Content-Type header to the correct value.
     * Will set the Cache-Control header for images to the max age of one month.
     *
     * @param response The response to write to.
     * @param fullPath The full path of the requested resource.
     */
    function tryAndServeFile(response, fullPath) {
        //Read and present the file.
        fs.exists(fullPath, function(exists) {
            //If the file does not exist, present a 404 error.
            if(!exists) {
                displayError(response, 404, "Resource not found!", fullPath);
            } else {
                fs.readFile(fullPath, "binary", function(error, file) {
                    if(error) {
                        //If there was an error while reading the file, present a 500 error.
                        logger.ERROR("Error serving file!", fullPath);

                        displayError(response, 500, "Error while serving content!");
                    } else {
                        var cntType = mime.lookup(fullPath);
                        logger.DEBUG("Serving: " + fullPath + "\t (" + cntType + ")");

                        //Present the file.
                        response.setHeader("Content-Type", cntType);
                        response.setHeader("Size", file.length);

                        //Add caching for images!
                        if(cntType.indexOf("image") > -1) {
                            response.setHeader("Cache-Control", "max-age=2678400, must-revalidate");
                        }

                        response.writeHead(200);
                        response.write(file, "binary");
                        response.end();
                    }
                });
            }
        });
    }

    /**
     * Will try and handle a rest endpoint. If any URL params have been defined, these will be extracted and passed to the actual endpoint.
     * The name of each defined param will be used to store the value in a variable within the object that is passed!
     * Will generate a 404 when the requested rest endpoint cannot be found!
     * Will generate a 400 if the number of parameters does not match with the required number.
     *
     * @param handles The handles array that contains all the mapped endpoints.
     * @param pathName The endpoint path.
     * @param request The request object.
     * @param response The response to write to.
     */
    function tryAndHandleRestEndpoint(handles, pathName, request, response) {
        //Find one-on-one mappings without params.
        if(pathName.lastIndexOf("*") < 0 && typeof handles[pathName] === 'object') {
            logger.INFO("Handling REST request: " + pathName);

            handles[pathName].execute(request, response);
        } else {
            //Handle REST endpoints that take in parameters.
            var correctedEndpoint = pathName.substring(0, pathName.lastIndexOf("/")) + "/*";
            if(typeof handles[correctedEndpoint] === "object") {
                logger.INFO("Handling REST request: " + pathName);

                var endpoint = handles[correctedEndpoint];
                var paramValues = pathName.substring(pathName.lastIndexOf("/") + 1, pathName.length).split("&");

                if(endpoint.params.length === paramValues.length) {
                    var params = {};
                    for(var i = 0; i < endpoint.params.length; i++) {
                        params[endpoint.params[i]] = paramValues[i]
                    }

                    logger.INFO("Params for endpoint processed: " + JSON.stringify(params, null, 4));
                    endpoint.execute(request, response, params);
                } else {
                    displayError(response, 400, "Parameters incorrect => Required: " + JSON.stringify(endpoint.params), pathName);
                }
            } else {
                displayError(response, 404, "Cannot find REST endpoint!", pathName);
            }
        }
    }

    /**
     * Adds an error the response object.
     *
     * @param response The response to add the error to.
     * @param type A number indicating the type of the error: 403,404,500,50x
     * @param message A message to show on screen that describes the error.
     */
    function displayError(response, type, message, pathName) {
        logger.ERROR(message + " (" + pathName + ")");

        response.writeHead(type, {"Content-Type": "text/plain"});
        response.write(message);
        response.end();
    }
};

module.exports = Router;