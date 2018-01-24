# Web Scrapping Challenge

This is the project to submit for Web Scrapping Challenge (organized by Bankin)

## Analyse the data webpage

Start URL: https://web.bankin.com/challenge/index.html

- Each web page have maximum **50** transactions row
- When open a data web page there are some cases:
    + Page does not show anything - an empty page (error in sending request , ...)
    + Page only show the button "Reload Transaction" -> Need to click on this button to get the data
    + Alert popup: "Opps! Something went wrong"
    + Page only show the header of transaction data table (This indicates that there is no more data)
    + Page with a transaction data in table
        - The data table can be in a DOM element which can be identified by ID `#dvTable`
        - The data table can be in an iframe which can be identified by ID `#fm`
- In the web page URL, the parameter `start=LAST_INDEX` can be used to ask the data which start from `LAST_INDEX`

So the main idea is to get the data from the page with `LAST_INDEX=0`, then increase the `LAST_INDEX` until we see the last page (which only show the header of transaction data table).

## Solutions

When we can see the transaction data table, the extracting data is not the big deal in this mission.
The main challenge here is how to get the data of the web page when it has been failed to open or failed to get data.
The first attempt is trying to request the same web page several and hope that we will get some data. But let's say after a number of times (`MAX_NB_TRY`), what can we do if we still cannot get data?
To resolve that problem, I will introduce two solutions: backstep and skipping URL. Both of them with the same goal is to change the _current URL_ to get new, fresh data.

### Backstep

The idea is to go back 1 step (increase the `LAST_INDEX` by 1) everytime we reach the limit number of try (`MAX_NB_TRY`).

There is also the limit number of step we can go back `MAX_BACK_STEP`, if we still cannot get the new data, we will stop here - **MISSION FAILED**

### Skipping URL

The idea is to skip the _current URL_ (by increase the `LAST_INDEX` by 50) everytime we reach the limit number of try (`MAX_NB_TRY`). Keep the skipped URL in a list and come back to try later on.

There is one case this method could be failed that is when we have only 1 last skipped URL but we cannot get the data after trying a number of times (`MAX_NB_TRY`).

## Implementation

I have chosen `phantomjs` and `Google Chrome Headless - puppeteer` as the tool to implement the above solutions. In fact we can use `phantomjs` (or `puppeteer`) to implement both solutions. But we have 2 solutions and I want to try with different tool so I have decied to have 2 implementations.

### phantomjs-backstep.js

This is the implementation of `backstep solution` implemented by using `phantomjs`

To start scrapping:

```
phantomjs phantomjs-backstep.js
```

The log outputs show the scrapping process

```
[LN:web-scrapping]$ phantomjs phantomjs-backstep.js 

---------------
Number of transactions: 0
Current URL: https://web.bankin.com/challenge/index.html
Number of try: 1
Number of back step: 0
[SUCCESS] Openned page: https://web.bankin.com/challenge/index.html
[CONSOLE] injectExternalTool: OK
[CONSOLE] [extractDataFromPage] ... 
[CONSOLE] Frame exists
[CONSOLE] listTRDOMs: 51
Return data: false - false - 50
GOOD - we are going for the next one
[onAlert] Oops! Something went wrong

---------------
Number of transactions: 50
Current URL: https://web.bankin.com/challenge/index.html?start=50
Number of try: 1
Number of back step: 0
[SUCCESS] Openned page: https://web.bankin.com/challenge/index.html?start=50
[CONSOLE] injectExternalTool: OK
[CONSOLE] [extractDataFromPage] ... 
[CONSOLE] Frame does not exists
[CONSOLE] dvTable exists -> Going to find Table
[CONSOLE] listTRDOMs: 0
Return data: true - false - 0
[CONSOLE] [extractDataFromPage] ... 
....
....

---------------


	MISSION COMPLETED!!!!
	Total number of collected data: 5048
	Number of transactions: 4148
	Collected transactions: 5048
	Duplicated transactions: 900
	Number of failed request: 87
	Number of error request: 36
	Total time: 21465 ms
	Output result: result-phantomjs.json
	Duplicated transactions: duplicated-result-phantomjs.json

```

The output result will be writtent in a json file `result-phantomjs.json`

```
[
    {
        "account": "Checking",
        "amount": 73,
        "currency": "€",
        "transaction": "Transaction 1"
    },
    {
        "account": "Checking",
        "amount": 54,
        "currency": "€",
        "transaction": "Transaction 2"
    },
    {
        "account": "Checking",
        "amount": 87,
        "currency": "€",
        "transaction": "Transaction 3"
    },
    {
        "account": "Checking",
        "amount": 76,
        "currency": "€",
        "transaction": "Transaction 4"
    },
    {
        "account": "Checking",
        "amount": 101,
        "currency": "€",
        "transaction": "Transaction 5"
    },
    ...

```

In the script, the consttans `MAX_NB_TRY` and `MAX_BACK_STEP` can be modified to have better result: increase -> more effecient, decrease -> faster

### puppet-skipURL.js

This is the implementation of `skipping URL solution` implemented by using `Google Chrome Headless puppeteer`

To start scrapping:

```
node puppet-skipURL.js
```

The log outputs show the scrapping process

```
[LN:web-scrapping]$ node puppet-skipURL.js 

---------------
Number of transactions: 0
Current URL: https://web.bankin.com/challenge/index.html
Number of try: 1
Number of data row: 50

---------------
Number of transactions: 50
Current URL: https://web.bankin.com/challenge/index.html?start=50
Number of try: 1
Number of data row: 50

---------------
Number of transactions: 100
Current URL: https://web.bankin.com/challenge/index.html?start=100
Number of try: 1
Number of data row: 50

....
....


---------------
	Number of transactions: 4999
	Collected transactions: 4999
	Duplicated transactions: 0
	Number of skipped url: 9
	Number of failed request: 81
	Number of error request: 0
	Total time: 219352 ms
	Output result: result-puppet.json

```

Output: `result-puppet.json`:

```
[
    {
        "account": "Checking",
        "transaction": "Transaction 1",
        "amount": 73,
        "currency": "€"
    },
    {
        "account": "Checking",
        "transaction": "Transaction 2",
        "amount": 54,
        "currency": "€"
    },
    {
        "account": "Checking",
        "transaction": "Transaction 3",
        "amount": 87,
        "currency": "€"
    },
```

## References

More about the challenge: https://blog.bankin.com/challenge-engineering-web-scrapping-dc5839543117