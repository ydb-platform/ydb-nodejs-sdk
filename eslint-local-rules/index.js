/**
 * @fileoverview Adds src/util/Context support over project code
 * @author Alexey Zorkaltsev
 */
"use strict";

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

const requireIndex = require("requireindex");

//------------------------------------------------------------------------------
// Plugin Definition
//------------------------------------------------------------------------------


// import all rules in lib/rules
module.exports = requireIndex(__dirname + "/rules");
