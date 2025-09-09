/**
 * Web.js
 *
 * This file is required by index.js. It sets up event listeners
 *
 * NODE.Js (http://nodejs.org)
 * Copyright Linux Foundation Collaborative (http://collabprojects.linuxfoundation.org/)
 *
 * @copyright     Linux Foundation Collaborative (http://collabprojects.linuxfoundation.org/)
 * @link          http://nodejs.org NODE.JS
 * @package       routes.js
 * @since         NODE.JS Latest version
 * @license       http://collabprojects.linuxfoundation.org Linux Foundation Collaborative
 */

/** Including contants file */
require("./../config/global_constant");

/** Including structure database constant file */
require("./../config/structure_database_constant");

/** include breadcrumb file **/
require(WEBSITE_ROOT_PATH + "breadcrumbs");

/** node cache module */
var NodeCache = require("node-cache");
myCache = new NodeCache();

/** Including common utility function folder */
require("./../utilities/utility_ai");

/** Including common utility gemini function folder */
require("./../utilities/utility_gemini_ai");

/** Including common utility data structure function folder */
require("./../utilities/utility_data_structure_ai");

/** Including common function */
require("./../utilities/utility");

/** Including common polls function */
require("./../utilities/utility_polls");

/** Including utility instagram function */
require("./../utilities/utility_instagram");

/** Including utility payment plan function */
require("./../utilities/utility_plan");

/** Including utility auth function */
require("./../utilities/utility_auth");

//let developerObj = new Student();
var cors = require("cors");

/**
 * Export a function, so that we can pass the app and io instances from app.js
 *
 * @param router As Express Object
 * @param io As Socket Io Object
 * @param mongo As Mongo db Object
 *
 * @return void.
 */
module.exports = {
  configure: function (router, io, mongo) {
    mongodb = mongo;
    db = mongodb.getDb();
    // ObjectId = require("mongodb").ObjectID;
    app = router;


    /** Start radis */
    if (POCIAL_LIVE_REDIS) {
      redisConnection = require("../config/redis_connection");
    }
    /** End radis */


    /** Middlewares **/
    /** Function to check admin is logged in or not */
    checkLoggedInAdmin = function (req, res, next) {

      /*** Start trim post data for all request */
      if (isPost(req)) {
        let bodyData = (req && req.body) ? req.body : {};
        Object.keys(bodyData).forEach(k => bodyData[k] = (typeof bodyData[k] == 'string') ? bodyData[k].trim() : bodyData[k]);
      }

      res.header("Cache-Control", "no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0");
      if (typeof req.session.user !== typeof undefined && typeof req.session.user._id !== typeof undefined && typeof req.session.user.user_role_id !== typeof undefined) {
        if (req.session.user.user_role_id == SUPER_ADMIN_ROLE_ID) {
          return next();
        } else {
          res.redirect(WEBSITE_ADMIN_URL + "login");
        }
      } else {
        res.redirect(WEBSITE_ADMIN_URL + "login");
      }
    }

    /** Function to check user is logged in or not **/
    checkLoggedIn = function (req, res, next) {
      res.header('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0');
      if (typeof req.session.user !== typeof undefined && typeof req.session.user._id !== typeof undefined && typeof req.session.user.user_role_id !== typeof undefined) {
        res.redirect('/login');
        return next();
      } else {
        res.redirect('/login');
        return next();
      }
    }

    /** Function to check if user is logged in then redirect him/her to dashboard */
    isLoggedIn = function (req, res, next) {
      res.header("Cache-Control", "no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0");
      if (typeof req.session !== typeof undefined && typeof req.session.user !== typeof undefined) {
        if (typeof req.session.user._id !== typeof undefined && typeof req.session.user.user_role_id !== typeof undefined) {
          res.redirect(WEBSITE_ADMIN_URL + "dashboard");
        } else {
          return next();
        }
      } else {
        return next();
      }
    }

    /** Before Filter **/
    app.use(async function (req, res, next) {
      process.setMaxListeners(0);
      /** Function to get unhandled errors and prevent to stop nodejs server **/
      process.on("uncaughtException", function (err) {
        console.log("error name ---------" + err.name);    // Print the error name
        console.log("error date ---------" + newDate('', DATABASE_DATE_TIME_FORMAT));    // Print the error name
        console.log("error message ---------" + err.message); // Print the error message
        console.log("error stack ---------" + err.stack);   // Print the stack trace
      });

      /** Rendering options to set views and layouts */
      req.rendering = {};

      res.locals.auth = "";
      if (req.session.user !== "undefined" && req.session.user) {
        res.locals.auth = req.session.user;
      }

      res.locals.site_url = req.url;

      /** Configure success flash message **/
      res.locals.success_flash_message = "";
      res.locals.success_status = "";

      /** Configure error flash message **/
      res.locals.error_flash_message = "";
      res.locals.error_status = "";

      if (typeof req.session.flash !== "undefined") {
        if (typeof req.session.flash.success !== "undefined") {
          res.locals.success_status = STATUS_SUCCESS;
          res.locals.success_flash_message = req.session.flash.success;
        }
        if (typeof req.session.flash.error !== "undefined") {
          res.locals.error_status = STATUS_ERROR;
          res.locals.error_flash_message = req.session.flash.error;
        }
      }


      /** Set default views folder path **/
      app.set("views", __dirname + "/views");
      /** Read/write Basic settings from/in Cache **/
      var settings = myCache.get("settings");
      if (settings == undefined) {

        /** radius settings */
        if (POCIAL_LIVE_REDIS) {
          var settingsData = await redisConnection.get(REDIS_SITE_SETTING);
          var settingsDataResult = JSON.parse(settingsData);
          if (settingsDataResult && Object.keys(settingsDataResult).length > 0) {
            myCache.set("settings", settingsDataResult, 0);
            res.locals.settings = settingsDataResult;
            next();
          } else {
            /** Write setting in cache **/
            await writeRedisSettingDetails(req, res);

            let settingsData = await redisConnection.get(REDIS_SITE_SETTING);
            let settingsDataResult = JSON.parse(settingsData);
            myCache.set("settings", settingsDataResult, 0);
            res.locals.settings = settingsDataResult;
            next();
          }
        } else {
          var fs = require("fs");
          fs.readFile(WEBSITE_ROOT_PATH + "config/settings.json", "utf8", function readFileCallback(err, data) {
            if (err) {
              next();
            } else {
              settings = JSON.parse(data);
              myCache.set("settings", settings, 0);
              res.locals.settings = settings;
              next();
            }
          });
        }
      } else {
        res.locals.settings = settings;
        next();
      }
    });

    app.use(cors());
    /** admin route start here **/

    /** Admin Before Filter **/
    app.use(FRONT_END_NAME + ADMIN_NAME + "/", function (req, res, next) {

      res.locals.active_path = req.path.split("/")[1];

      res.locals.admin_list_url = WEBSITE_ADMIN_URL + res.locals.active_path;
      res.locals.breadcrumb = req.breadcrumbs();

      res.locals.active_path1 = req.path.split("/")[1];
      res.locals.active_path2 = req.path.split("/")[2];
      res.locals.active_path4 = req.path.split("/")[4];

      if (res.locals.active_path4 == 'get_script_code_preview' || res.locals.active_path2 == 'add_drag_drop' || res.locals.active_path2 == 'sample_embed' || res.locals.active_path2 == 'subscriber_send_mail') {
        req.rendering.layout = WEBSITE_ADMIN_LAYOUT_PATH + "blank";

      } else {
        /** Set default layout for admin **/
        req.rendering.layout = WEBSITE_ADMIN_LAYOUT_PATH + "default";
      }

      /** Read/write admin Modules from/in Cache **/
      if (!isPost(req) && typeof req.session.user !== typeof undefined) {
        let userId = (req.session.user._id) ? req.session.user._id : "";
        var moduleLists = userModuleFlagAction(userId, "", "get");
        if (moduleLists == undefined) {
          var adminModules = require(WEBSITE_ADMIN_MODULES_PATH + "admin_modules/model/admin_module");
          adminModules.getAdminModulesListing(req, res).then(function (moduleResponse) {
            res.locals.admin_modules_list = moduleResponse.result;
            userModuleFlagAction(userId, moduleResponse.result, "add");
            next();
          });
        } else {
          res.locals.admin_modules_list = moduleLists;
          next();
        }
      } else {
        res.locals.admin_modules_list = [];
        next();
      }
    });

    /** Include Users Module **/
    require(WEBSITE_ADMIN_MODULES_PATH + "users/routes");
 
    /** Include Api Module **/
    require(WEBSITE_MODULES_PATH + "api/routes");

    /** Include crons Module **/
    require(WEBSITE_MODULES_PATH + "crons/routes");

    /** Route is used to render 404 page */
    app.get(new RegExp("^" + FRONT_END_NAME + ADMIN_NAME + "/.*$"), function (req, res) {
      let layout404 = WEBSITE_ADMIN_LAYOUT_PATH + "404";
      if (res.locals.auth && res.locals.auth._id) {
        layout404 = WEBSITE_ADMIN_LAYOUT_PATH + "default";
      }
      /** Set current view folder **/
      req.rendering.views = WEBSITE_ADMIN_MODULES_PATH + "elements/";

      /** Set layout  404 **/
      req.rendering.layout = layout404;

      /**Render 404 page*/
      res.render("404");
    });

    /** front route start here */

    /** Front Before Filter */
    app.use(FRONT_END_NAME, function (req, res, next) {
      res.locals.active_path = req.path.split("/")[1];
      res.locals.active_tab = req.path.split("/")[2];
      res.locals.list_url = WEBSITE_URL + res.locals.active_path;

      /** Set default layout for front **/
      req.rendering.layout = WEBSITE_LAYOUT_PATH + "default";
      next();
    });

    /** Routing for socket connection **/
    io.on("connection", function (socket) {
      // var socketModel = require(WEBSITE_MODULES_PATH + "socket/model/socket");
      // socketModel.init(io, socket);
      socket.disconnect();
    });

    /** Route is used to check server health */
    app.get('/health-check', async (_req, res, _next) => {
      const healthcheck = {
        uptime: process.uptime(),
        status: 200,
        message: 'OK',
        timestamp: Date.now()
      };
      try {
        res.send(healthcheck);
      } catch (error) {
        healthcheck.message = error;
        res.status(503).send();
      }
    });

    /** Route is used to for 404 page */
    app.get(/.*/, function (req, res) {
      res.redirect(WEBSITE_ADMIN_URL);
      return;
    });

    /** After Filter */
    // app.use(function (req, res, next) {
    //   if (typeof req.route !== typeof undefined && typeof req.route.path !== typeof undefined && req.route.path == FRONT_END_NAME + 'mobile_api') {
    //     /** Send respo **/
    //     var result = res.result;
    //     if (typeof result.status === typeof undefined) {
    //       result.status = STATUS_SUCCESS;
    //     }
    //     if (result.status == STATUS_SUCCESS || result.status == STATUS_ERROR) {
    //       if (typeof result.message !== typeof undefined) {
    //         if (typeof result.message == 'string') {
    //           var oldMessage = result.message;
    //           result.message = [{
    //             msg: oldMessage,
    //             param: result.status
    //           }];
    //         }
    //       } else {
    //         result.message = [{
    //           msg: STATUS_SUCCESS,
    //           param: STATUS_SUCCESS
    //         }];
    //       }
    //     }

    //     var methodName = req.body.method;
    //     var modelName = req.body.model;
    //     result["_method_name"] = methodName;
    //     result["_model_name"] = modelName;
    //     result = JSON.stringify(result);
    //     var base64 = require('base-64');
    //     var utf8 = require('utf8');
    //     var bytes = utf8.encode(result);
    //     var encoded = base64.encode(bytes);
    //     res.send(encoded);
    //   } else {
    //     var methodName = (req.body.method) ? req.body.method : "";
    //     var modelName = (req.body.model) ? req.body.model : "";
    //     res.send(res.result);
    //   }
    // });

    /** Error Handling */
    app.use(function (err, req, res, next) {
      console.log('Error handled in web.js routing');
      if (err.stack) {
        console.error(err.stack);
      } else {
        console.error(err);
      }

      let currentPanel = (req.path.split("/")[1]) ? req.path.split("/")[1] : "";
      if (req.method == "POST") {
        /** If request is from admin panel */
        if (currentPanel == ADMIN_NAME) {
          /** This response is work for both listing requests and other requests */
          return res.send({
            status: STATUS_ERROR,
            message: res.__("admin.system.something_going_wrong_please_try_again"),
            draw: 0,
            data: [],
            recordsFiltered: 0,
            recordsTotal: 0
          });
        } else {
          if (isMobileApi(req, res)) {
            var result = {};
            var methodName = req.body.method;
            var modelName = req.body.model;
            result["_method_name"] = methodName;
            result["_model_name"] = modelName;
            result["status"] = STATUS_ERROR;
            result["message"] = res.__("admin.system.something_going_wrong_please_try_again");
            result = JSON.stringify(result);
            var base64 = require('base-64');
            var utf8 = require('utf8');
            var bytes = utf8.encode(result);
            var encoded = base64.encode(bytes);
            return res.send(encoded);
          }
          return res.send({
            status: STATUS_ERROR,
            message: res.__("admin.system.something_going_wrong_please_try_again"),
          });
        }
      }
      let viewPath = WEBSITE_LAYOUT_PATH;

      // Ensure req.rendering exists before setting its properties
      if (!req.rendering) {
        req.rendering = {};
      }

      /* If request is from admin panel */
      if (currentPanel == ADMIN_NAME) {
        /* Set view path to elements folder in admin panel */
        viewPath = WEBSITE_ADMIN_MODULES_PATH + "elements/";
        /* Set layout path */
        let layout404 = WEBSITE_ADMIN_LAYOUT_PATH + "404";
        if (res.locals && res.locals.auth && res.locals.auth._id) {
          layout404 = WEBSITE_ADMIN_LAYOUT_PATH + "default";
        }
        /** Set layout  404 **/
        req.rendering.layout = layout404;

        /** Set current view folder **/
        req.rendering.views = viewPath;

        /**Render error page*/
        return res.render("error");
      }

      /** Set current view folder **/
      req.rendering.views = viewPath;

      /**Render error page*/
      return res.render("404", {
        layout: false
      });
    });

    
  }
};
