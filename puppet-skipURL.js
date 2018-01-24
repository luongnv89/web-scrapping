/**
 * The script to submit the web scrapping challenge: https://blog.bankin.com/challenge-engineering-web-scrapping-dc5839543117
 *
 * To start scrapping data:
 *
 * $ node puppet-skipURL.js
 *
 * The output result in the file: result-puppet.json
 *
 * The const: MAX_NB_TRY can be modified to have better result: increase -> more effecient, decrease -> faster
 * 
 * @author Luong NGUYEN - luongnv89@gmail.com
 *
 */
const puppeteer = require('puppeteer'),
    fs = require('fs');

const ROOT_URL = 'https://web.bankin.com/challenge/index.html', // Start URL to get data
    MAX_NB_TRY = 3, // Maximum number of time trying to get data from one URL
    INDEX_STEP = 50, // Maximum number of transaction per page (to skip)
    OUTPUT_FILE = 'result-puppet.json'; // output file contains result

var allData = []; // contains all data that we have collected
/**
 * Extract data from a page
 *
 */
function extractData() {

    // INNER FUNCTIONS
    /**
     * Load Jquery dynamically
     */
    function loadJQuery() {
        // Load the script
        var script = document.createElement('script');
        script.src = 'https://code.jquery.com/jquery-3.2.1.min.js';
        script.type = 'text/javascript';
        script.onload = function () {
            console.log('jQuery has been loaded!');
        };
        document.getElementsByTagName('head')[0].appendChild(script);
    }
    /**
     * Extract amount from string
     * $234.43 -> return: 234.43
     * 234.43$ -> return: 234.43
     */
    function extractAmount(str) {
        return Number(str.replace(/[^0-9\.-]+/g, ''));
    }
    /**
     * Extract currency from string
     * $234.43 -> return: $
     * 234.43$ -> return: $
     * 234$ 43 -> return: $
     */
    function extractCurrency(str) {
        return str.replace(/[0-9,\.,\,]/g, '');
    }
    /**
     * Extract a transaction data from a TR DOMElement
     * @param DOMElement trDOM  TR DOMELement
     * @returns
     *  null: if the trDOM Element holds the invalid data (the number of cells is not 3)
     *  A JSON object which contains the information of a transaction
     */
    function processTRDOM(trDOM) {
        var listTDs = trDOM.cells;

        if (listTDs.length !== 3) {
            console.log('trDOM data is invalid: ' + JSON.stringify(trDOM));
            return null;
        }
        var data = {
            account: listTDs[0].innerHTML.trim(),
            transaction: listTDs[1].innerHTML.trim(),
            amount: extractAmount(listTDs[2].innerHTML.trim()),
            currency: extractCurrency(listTDs[2].innerHTML.trim())
        }
        return data;
    }

    // END OF INNER FUNCTIONS

    var data = [],
        listTRDOMs = [];

    var dvTable = document.getElementById('dvTable');
    if (dvTable) {
        listTRDOMs = dvTable.querySelectorAll('tr');
    }

    // Get TRDOMs from iframe
    if (listTRDOMs.length === 0) {
        var frameData = document.querySelector('iframe#fm');
        if (frameData) {
            var innerDOC = frameData.contentWindow.document || frameData.contentDocument;
            if (!innerDOC) {
                console.log('Could not get innerDOC');
            } else {
                listTRDOMs = innerDOC.querySelectorAll('tr');
            }
        } else {
            console.log('[ERROR] Could not get frameData');
        }

    }

    // Extract data
    // Check jquery
    if (!window.jQuery) {
        console.log('NEED TO LOAD JQUERY...!');
        loadJQuery();
    }

    // Check the last page
    if (listTRDOMs.length === 1) {
        data = ['NO_DATA'];
    }

    for (var index = 1; index < listTRDOMs.length; index++) {
        var trDOM = listTRDOMs[index];
        var r_data = processTRDOM(trDOM);
        if (r_data) {
            console.log('Adding new data: ', r_data);
            data.push(r_data);
        }
    }
    return data;
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
 * Remove duplicated transactions from an array
 * @param {*} array_data array data need to remove the duplicated transactions
 */
function remove_duplicated_trans(array_data, unique_data, duplicated_data) {
    var index1 = 0,
        index2 = 0;
    for (index1 = 0; index1 < array_data.length; index1++) {
        var current_data = array_data[index1];
        var is_duplicated = false;
        for (index2 = 0; index2 < unique_data.length; index2++) {
            if (current_data.account === unique_data[index2].account
                && current_data.amount === unique_data[index2].amount
                && current_data.currency === unique_data[index2].currency
                && current_data.transaction === unique_data[index2].transaction){
                    is_duplicated = true;
                    break;
                }
        }
        if (is_duplicated) {
            console.log('Duplicated: ' + JSON.stringify(current_data,null,2));
            duplicated_data.push(current_data);
        } else {
            unique_data.push(current_data);
        }
    }
}

/**
 * Start scrapping data
 * - Do the loop until stopScrapping is true:
 *      - Open and get data from current page: the result can be SUCCESS or FAILED
 *
 *      FAILED:
 *      - Failed in case:
 *          + failed to open the page
 *          + cannot get the data
 *          + get the data but there are duplicated data
 *      - if FAILED then try to request some more times
 *      - if after trying MAX_NB_TRY times we still cannot get the data, skip current page (add current page to skipped list) and go to the next page by increasing the current index with INDEX_STEP
 *
 *      SUCCESS:
 *      - if we see the last page (which contains only the table header of transaction) -> comeback to try to get data from the skipped list until there is no more skipped url (update stopScrapping to be true)
 *      - if the datas are not duplicated, then add to the list of data and go to next page by increasing the current index with INDEX_STEP
 */
async function run() {

    var current_nb_try = 0, // current number of times trying to get data from one page
        nb_failed = 0, // number of time failed to get data
        nb_error = 0, // number of time failed to open the page
        nb_skipped_urls = 0, // number of urls has been skipped (then will be re-try after)
        nb_duplicated = 0, // Number of duplicated transaction
        seen_last_page = false, // true: if we have found the last page - which have only the table header and no data
        current_url = ROOT_URL, // Current processing URL
        last_index = 0, // Last index page -> the value of parameter: start=last_index
        stopScrapping = false, // true to stop scrapping data
        skip_urls = []; // list of skipped urls

    const browser = await puppeteer.launch({
        headless: true
    });

    const page = await browser.newPage();

    // Show the console message
    // page.on('console', msg => console.log('-->[console]: ', msg.text));

    // Dismiss the popup
    page.on('dialog', async dialog => {
        console.log('Dismiss the dialog: ' + dialog.message());
        await dialog.dismiss();
    });


    // Start scrapping
    while (!stopScrapping) {
        current_nb_try++;
        console.log('\n---------------');
        console.log('Number of transactions: ' + allData.length);
        console.log('Current URL: ' + current_url);
        console.log('Number of try: ' + current_nb_try);

        try {
            // console.log('Going to open page: ' + current_url);
            await page.goto(current_url, {
                waitUntil: 'networkidle2'
            });

            var page_data = null;

            // console.log('Try to get the data from dvTable');
            page_data = await page.evaluate(extractData);

            if (page_data.length === 0) {

                // console.log('Need to click on btnGenerate');
                const btnGen = await page.evaluate(() => {

                    console.log('Going to find and click on btnGenerate');
                    var btnGenerate = document.getElementById('btnGenerate');

                    if (btnGenerate) {
                        console.log('Click btnGenerate');
                        btnGenerate.click();
                        return true;
                    }
                    console.log('btnGenerate does not exist!');
                    return false;

                });

                // console.log('Going to find the list of TRDOM in the page');
                page_data = await page.evaluate(extractData);
            }

            console.log('Number of data row: ' + page_data.length);
            // Update data
            if (page_data.length > 1) {
                // Check for duplicate
                if (!check_data_overlap(allData, page_data)) {
                    current_nb_try = 0; // Reset number of try for current url
                    allData = allData.concat(page_data);
                } else {
                    console.log('DUPLICATED!!!!!!!');
                    nb_duplicated++;
                    page_data = [];
                }
            }

            // Check last page condition
            if (page_data.length === 1) {
                if (page_data[0] === 'NO_DATA') {
                    console.log('All data has been collected!');
                    console.log('Number of skipped URLs: ' + skip_urls.length);
                    nb_skipped_urls = skip_urls.length;
                    seen_last_page = true;
                } else {
                    current_nb_try = 0; // Reset number of try for current url
                    allData = allData.concat(page_data);
                }
            }

            // Bulding current_url for next round
            if (!seen_last_page) {

                if (page_data.length === 0) {
                    console.log('[FAILED] ' + current_url);
                    nb_failed++;
                    if (current_nb_try >= MAX_NB_TRY) {
                        current_nb_try = 0; // Reset number of try
                        // Skip current page and go for next one
                        skip_urls.push(current_url);
                        //TODO: Need a mechanism that we will skip & mark the index of skiping records -> comeback and re-try it later -> Depend on the INDEX_STEP
                        // Another approach: change the url by go back 1 (Maximum 5) transaction -> then on the next transaction, we skip counting for the transaction that we have go back
                        last_index += INDEX_STEP; // Move 1 step to avoid problem

                    }
                } else {
                    // Go to next page normally
                    last_index += page_data.length;
                }
                current_url = ROOT_URL + '?start=' + last_index;
            } else {
                if (skip_urls.length > 0) {
                    console.log('Number of remain url: ' + skip_urls.length);
                    // Re try with the skipped URLs
                    if (page_data.length === 0) {
                        console.log('[FAILED] ' + current_url);
                        nb_failed++;
                        if (current_nb_try >= MAX_NB_TRY) {
                            current_nb_try = 0; // Reset number of try
                            // Re-try does not work - add current URL back to the list and try with other
                            if (skip_urls.length > 0) {
                                newcurrent_url = skip_urls.pop();
                                skip_urls.push(current_url);
                                current_url = newcurrent_url;
                            } else {
                                console.log('I am too tired .... ');
                                stopScrapping = true;
                                break;
                            }
                        }
                        // Continue with current URL
                    } else {
                        // Re-try works -> go to next url
                        current_url = skip_urls.pop();
                    }
                } else {
                    if (page_data.length > 0) {
                        console.log('RE-TRY all the page');
                        stopScrapping = true;
                        break;
                    } else {
                        // The last URL
                        if (current_nb_try >= MAX_NB_TRY) {
                            console.log('I am too tired .... ');
                            stopScrapping = true;
                            break;
                        }
                    }

                }
            }
        } catch (error) {
            // Also need to skip current page and try with the next one
            console.log(error);
            console.log('Skip current URL and continue...');
            console.log('[ERROR] ' + current_url);
            nb_error++;
            if (current_nb_try >= MAX_NB_TRY) {
                if (!seen_last_page) {
                    skip_urls.push(current_url);
                    //TODO: Need a mechanism that we will skip & mark the index of skiping records -> comeback and re-try it later -> Depend on the INDEX_STEP
                    // Another approach: change the url by go back 1 (Maximum 5) transaction -> then on the next transaction, we skip counting for the transaction that we have go back
                    last_index += INDEX_STEP; // Move 1 step to avoid problem
                    current_url = ROOT_URL + '?start=' + last_index;
                } else {
                    if (skip_urls.length > 0) {
                        newcurrent_url = skip_urls.pop();
                        skip_urls.push(current_url);
                        current_url = newcurrent_url;
                    } else {
                        console.log('I am too tired .... ');
                        stopScrapping = true;
                        break;
                    }

                }
            }
        }
    }

    console.log('\n---------------');
    var total_time = Date.now() - start_time;
    // Remove the duplicated data
    var final_data = [],
        duplicated_data = [];
    remove_duplicated_trans(allData, final_data, duplicated_data);
    console.log('\tNumber of transactions: ' + final_data.length);
    console.log('\tCollected transactions: ' + allData.length);
    console.log('\tDuplicated transactions: ' + duplicated_data.length);
    console.log('\tNumber of skipped url: ' + nb_skipped_urls);
    console.log('\tNumber of failed request: ' + nb_failed);
    console.log('\tNumber of error request: ' + nb_error);
    console.log('\tTotal time: ' + total_time + ' ms');
    // Write data to the output file
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(final_data, null, 4));
    console.log('\tOutput result: ' + OUTPUT_FILE);
    if (duplicated_data.length > 0) {
        fs.writeFileSync('duplicated-'+OUTPUT_FILE, JSON.stringify(duplicated_data, null, 4));
        console.log('\tDuplicated transactions: ' + OUTPUT_FILE + '\n\n');
    }
    await browser.close();
};
var start_time = Date.now();
run();