/**
 * The script to submit the web scrapping challenge: https://blog.bankin.com/challenge-engineering-web-scrapping-dc5839543117
 *
 * To start scrapping data:
 *
 * $ phantomjs phantomjs-backstep.js
 *
 * The output result in the file: result-phantomjs.json
 * 
 * The const: MAX_NB_TRY and MAX_BACK_STEP can be modified to have better result: increase -> more effecient, decrease -> faster
 * 
 * @author Luong NGUYEN - luongnv89@gmail.com
 *
 */
var webpage = require('webpage'),
    fs = require('fs');

const ROOT_URL = 'https://web.bankin.com/challenge/index.html', // start URL to get data
    MAX_NB_TRY = 5, // Maximum number of time trying to get data from one URL
    MAX_BACK_STEP = 5, // Maximum number of step of going backward when failed to get data from one URL
    OUTPUT_FILE = 'result-phantomjs.json'; // output file contains result

var nb_failed = 0, // number of time failed to get data
    nb_error = 0, // Number of time failed to open the page
    current_nb_back_steps = 0, // Current number of backward step
    current_nb_try = 0, // Current number of time trying to get data from one page
    current_url = ROOT_URL, // Current processing URL
    current_index = 0, // Current index - the index in url (?start=current_index)
    allData = []; // contains all data that we have collected

// INNER FUNCTIONS - WHICH WILL BE EXECUTED IN WEBSITE CONSOLE
/**
 * Global functions, variables, ... that we will use when evaluating the web page
 */
function injectExternalTool() {
    window.extTools = {
        // External global variables
        version: '1.0',
        // End of external global variables
        // External functions
        /**
         * Load jquery if needed
         */
        loadJQuery: function () {
            // Load the script
            var script = document.createElement('script');
            script.src = 'https://code.jquery.com/jquery-3.2.1.min.js';
            script.type = 'text/javascript';
            script.onload = function () {
                console.log('jQuery has been loaded!');
            };
            document.getElementsByTagName('head')[0].appendChild(script);
        },
        /**
         * Extract amount from string
         * $234.43 -> return: 234.43
         * 234.43$ -> return: 234.43
         */
        extractAmount: function (str) {
            return Number(str.replace(/[^0-9\.-]+/g, ''));
        },
        /**
         * Extract currency from string
         * $234.43 -> return: $
         * 234.43$ -> return: $
         * 234$ 43 -> return: $
         */
        extractCurrency: function (str) {
            return str.replace(/[0-9,\.,\,]/g, '');
        },
        /**
         * Click on an DOM element by given id
         * @param String id  The id of the element
         * @returns
         * true: if the Element has been clicked
         * false: if cannot find the element with given id
         */
        clickById: function (id) {
            if (document.getElementById(id)) {
                document.getElementById(id).click();
                return true;
            }
            return false;
        },
        /**
         * Get list of TR DOM elements
         * Each TR DOM element holds the data of a transaction (except the table header)
         * When open the transaction page, there are 2 possiblities:
         *  - The transaction data in a DOMElement with id: dvTable
         *  - The transaction data in an iframe with the id: fm
         */
        getListTRDOMs: function () {
            var listTRDOMs = [];
            // First - try to get from iframe
            var frameData = document.querySelector('iframe#fm');
            if (frameData) {
                // Process the iframe
                console.log('Frame exists');
                var innerDOC = frameData.contentWindow.document || frameData.contentDocument;
                if (!innerDOC) {
                    console.log('Could not get innerDOC');
                } else {
                    listTRDOMs = innerDOC.querySelectorAll('tr');
                }
            } else {
                console.log('Frame does not exists');
            }

            // Then - if there is no TR, try to get from dvTable
            if (listTRDOMs.length === 0) {
                var dvTable = document.getElementById('dvTable');
                if (!dvTable) {
                    console.log('dvTable doesn\'t exist -> Try one more time');
                } else {
                    console.log('dvTable exists -> Going to find Table');
                    listTRDOMs = dvTable.querySelectorAll('tr');
                }
            }

            return listTRDOMs;
        },
        /**
         * Extract a transaction data from a TR DOMElement
         * @param DOMElement trDOM  TR DOMELement
         * @returns
         *  null: if the trDOM Element holds the invalid data (the number of cells is not 3)
         *  A JSON object which contains the information of a transaction
         */
        extractDataFromTRDOM: function (trDOM) {},
        /**
         * Extract transaction data from a website
         * @returns
         * A JSON object which contains the information about the page:
         * - no_content: true if the page does not have any TR DOMElement
         * - last_page: true if the page content only the header of the table (only 1 TR DOMElement)
         * - trans: list of all transaction data in the page
         */
        extractDataFromPage: function () {},
    };

    extTools.extractDataFromTRDOM = function (trDOM) {
        var listTDs = trDOM.cells;

        if (listTDs.length !== 3) {
            console.log('trDOM data is invalid: ' + JSON.stringify(trDOM));
            return null;
        }
        var data = {
            account: listTDs[0].innerHTML.trim(),
            transaction: listTDs[1].innerHTML.trim(),
            amount: extTools.extractAmount(listTDs[2].innerHTML.trim()),
            currency: extTools.extractCurrency(listTDs[2].innerHTML.trim())
        }
        return data;
    };

    extTools.extractDataFromPage = function () {
        console.log('[extractDataFromPage] ... ');
        var no_content = false,
            last_page = false,
            trans = [];

        if (!window.jQuery) {
            console.log('NEED TO LOAD JQUERY...!');
            extTools.loadJQuery();
        }
        var listTRDOMs = extTools.getListTRDOMs();
        console.log('listTRDOMs: ' + listTRDOMs.length);
        if (listTRDOMs.length === 0) {
            // There is no TR on page
            no_content = true;
        } else if (listTRDOMs.length === 1) {
            // Found the last page
            last_page = true;
        } else {
            // We have some data
            for (var index = 1; index < listTRDOMs.length; index++) {
                var trDOM = listTRDOMs[index];
                var r_data = extTools.extractDataFromTRDOM(trDOM);
                if (r_data) {
                    // console.log("Adding new data: ")
                    trans.push(r_data);
                }
            }
        };
        return {
            'no_content': no_content,
            'last_page': last_page,
            'trans': trans
        };
    };
    console.log('injectExternalTool: OK');
}

/**
 *
 * Try to extract data from data page
 *
 * @param {boolean} btnClick true -> need to click the btnGenerate, false -> No need to click the button
 */
function DOMManipulate(btnClick) {
    var data = {
        no_content: false,
        last_page: false,
        trans: []
    };
    if (typeof extTools === 'undefined') {
        console.log('-> ERROR: could not find extTools');
    } else {
        if (btnClick) {
            // Click on btnGenerate to generate data
            extTools.clickById('btnGenerate');
        }
        data = extTools.extractDataFromPage();
    }
    return data;
}

// End of inner function

////////////////////////////////////////////////////////////////////////////////
/**
 * Create a new phantomjs webpage object and register some event handler
 * @returns
 * a new page
 */
function createNewPage() {
    newPage = webpage.create();

    newPage.onResourceError = function (resourceError) {
        console.log('[ERROR] resourceError: ' + JSON.stringify(resourceError, undefined, 4));
    };

    newPage.onError = function (msg, trace) {
        system.stderr.writeLine('[ERROR]: ');
        var msgStack = ['ERROR: ' + msg];
        if (trace) {
            msgStack.push('TRACE:');
            trace.forEach(function (t) {
                msgStack.push('-> ' + t.file + ': ' + t.line + (t.function ? ' (in function "' + t.function+'")' : ''));
            });
        }
        system.stderr.writeLine(msgStack.join('\n'));
    };

    // newPage.onConsoleMessage = function (message) {
    //     console.log('[CONSOLE] ' + message);
    // };

    // newPage.onAlert = function (message) {
    //     console.log("[onAlert] " + message);
    // };

    return newPage;
}

/**
 * Check if there exists at least 1 element in both a1 and a2
 * @param {*} a1
 * @param {*} a2
 */
function check_data_overlap(a1, a2) {
    for (var index = 0; index < a1.length; index++) {
        for (var index2 = 0; index2 < a2.length; index2++) {
            if (a1[index].transaction === a2[index2].transaction) {
                console.log('Duplicated transaction: ' + a1[index].transaction);
                return true;
            }
        }
    }
    return false;
}


/**
 * Finish scrapping data when the mission is completed or there are some error when trying to get data
 *
 * Show the result of scrapping process:
 * - allData: list of JSON objects which contain the information of all transactions
 * - Total number of time failed to get data
 * - Total number of time failed to load the page
 *
 * Wait 3 seconds before exiting
 * @param {boolean} status Indicate the finishing is a mission completed (0) or failed mission (>0)
 */
function finish_scrapping(status) {
    console.log('\n---------------');
    var total_time = Date.now() - start_time;
    if (!status) {
        console.log('\n\n\tMISSION COMPLETED!!!!');
    } else {
        console.log('\n\n\tFAILED FAILED FAILED!!!!');
    }
    console.log('\tTotal number of collected data: ' + allData.length);
    console.log('\tNumber of transactions: ' + allData.length);
    console.log('\tNumber of failed request: ' + nb_failed);
    console.log('\tNumber of error request: ' + nb_error);
    console.log('\tTotal time: ' + total_time + ' ms');
    // Write data to the output file
    fs.write(OUTPUT_FILE, JSON.stringify(allData, null, 4), 'w');
    console.log('\tOutput result: ' + OUTPUT_FILE);

    setTimeout(function () {
        phantom.exit(status);
    }, 3000);
}

/**
 * Update data page url on failed (to load the page or to get data)
 * -> Check if the number of time trying to get the data is less than MAX_NB_TRY -> simply reload the page, do not need to change current_url
 * -> Otherwise:
 *      -> Check if the number of backward steps is less than MAX_BACK_STEP -> change data page url backward 1 step and reload the page
 *      -> Otherwise: FINISHED SCRAPPING -> MISSION FAILED FAILED FAILED!
 */
function update_data_page_url_on_failed() {
    if (current_nb_try >= MAX_NB_TRY) {
        current_nb_try = 0; // Reset number of try
        current_nb_back_steps++; // Backstep 1 more step
        current_index--; // Move 1 step to avoid problem
        if (current_nb_back_steps >= MAX_BACK_STEP || current_index < 0) {
            console.log('[TIRED] Going to quit ...');
            return finish_scrapping(1);
        }
    }
}

/**
 * Callback function which is called after a data page has been loaded!
 * When open a data page, there are some posibilities:
 * - Empty page: page does not content any tr DOMElement and there is no generate button (id="btnGenerate")
 *      -> Go to: reload_the_page
 * - Waiting page: page does not content any tr DOMElement and there is a generate button (id="btnGenerate")
 *      -> Click on the generate button (id="btnGenerate")
 *      -> then try to get data (see Data page bellow)
 *      -> then if there is still no data -> Go to: reload_the_page
 * - Data page: page contains the some tr DOMElements (can be only 1). The data can be in an iframe (with id="fm") or in a table which is in a div tag (with id="dvTable")
 *      -> call extractDataFromPage to get data
 * - Last page: the page contains only table header of transaction data table
 *      -> At this point, we have collected all the data available.
 *      -> MISSION COMPLETED!!!!!!
 * - Failed to load the page
 *      -> Go to: reload_the_page
 *
 * reload_the_page
 *      -> check if the number of time trying to get data is less than MAX_NB_TRY -> Simply reload the page
 *      -> otherwise:
 *             -> check if the number of backward steps is less than MAX_BACK_STEP -> Go backward 1 more step and reload the page
 *             -> otherwise: finished -> FAILED FAILED FAILED
 *
 * @param {boolean} status the status of openning page: 'success' or 'failed'
 */
function pageOpenCallback(status) {

    current_nb_try++;

    console.log('\n---------------');
    console.log('Number of transactions: ' + allData.length);
    console.log('Current URL: ' + current_url);
    console.log('Number of try: ' + current_nb_try);
    console.log('Number of back step: ' + current_nb_back_steps);

    if (status === 'success') {
        console.log('[SUCCESS] Openned page: ' + current_url);
        // Inject external functions and variables
        page.evaluate(injectExternalTool);

        // First attempt to get data
        var returnData = page.evaluate(DOMManipulate, false);

        console.log('Return data: ' + returnData.no_content + ' - ' + returnData.last_page + ' - ' + returnData.trans.length);

        if (returnData.no_content) {
            // Second attempt to get data - need to click on btnGenerate
            returnData = page.evaluate(DOMManipulate, true);
            console.log('Return data (2): ' + returnData.no_content + ' - ' + returnData.last_page + ' - ' + returnData.trans.length);
        }

        // Check if we found the last page
        if (returnData.last_page) {
            console.log('All data has been collected!');
            return finish_scrapping(0);
        }
        // Check if we have some new data
        if (!returnData.no_content && returnData.trans.length > (current_nb_back_steps + 1)) {
            console.log('GOOD - we are going for the next one');
            // There is some data
            var new_data = returnData.trans.slice(current_nb_back_steps);
            if (check_data_overlap(allData,new_data)) { // Make sure we get new data
                console.log('[FAILED] overlap data ' + current_url);
                nb_failed++;
                update_data_page_url_on_failed();
            } else {
                allData = allData.concat(new_data);
                current_nb_try = 0; // Reset number of try for current url
                current_nb_back_steps = 0;
                // Go to next page normally
                current_index += returnData.trans.length - current_nb_back_steps;
            }
        } else {
            console.log('[FAILED] ' + current_url);
            nb_failed++;
            update_data_page_url_on_failed();
        }
        // page.render('screenshot-'+current_index+'-'+current_nb_try+'.png');
    } else {
        // Failed to load the page
        console.log('[ERROR] Cannot open page: ' + current_url);
        // Also need to skip current page and try with the next one
        nb_error++;
        update_data_page_url_on_failed();
        // Close the page and recreate the page - avoid operation cancel error (5)
        page.close();
        page = createNewPage();
    }
    // Reload the data page
    current_url = ROOT_URL + '?start=' + current_index;
    page.open(current_url, pageOpenCallback);
}

////////////////////////////////////////////////////////////////////////////////
page = createNewPage();
var start_time = Date.now();
page.open(current_url, pageOpenCallback);