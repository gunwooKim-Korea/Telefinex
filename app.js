/*
모든 request header, body엔 각각 필수값이 있다

header :
api key 	// api key
payload 	// body를 base64로 encode한 데이터
signature 	// apiSecret값, payload를 HASH 함수를 돌려 만든 값

body :
request		// api의 uri
nonce		// 현재날짜, 시간 ex) 07 Oct 2018 03:05:27 GMT

가 필요한데, make_option함수에서 추가해주기때문에 각 request packet 생성할 때 넣어주지않아도됨

request를 보내는건, options을 보냄
options을 구성하는건 header와 body, uri고

header	: apikey, payload, signature
body	: 각 uri의 endpoint가 필요한 데이터들
*/
const request = require('request');
const crypto = require('crypto');
const fetch = require('node-fetch');
const fs = require('fs');
const dpdlvldkdlzl = require('./dpdlvldkdlzl');
const Telebot = require('telebot');
const telegramAPI = require('./telegram');

const baseUri = 'https://api.bitfinex.com';

var today = new Date();
var dd = today.getDate();
var mm = today.getMonth()+1; //January is 0!
var yyyy = today.getFullYear();

if(dd<10){
    dd='0'+dd
}

if(mm<10){
    mm='0'+mm
}

const bot = new Telebot(telegramAPI.telegramToken);

function sendTelegram(message){

	fetch('https://api.telegram.org/bot' + telegramAPI.telegramToken + '/sendMessage?chat_id=' + telegramAPI.chatId + '&text=' + message.toString('base64') + '\n', {})
        .then(res => res.json())
        .then(res => {
        	console.log(res);
        });

    return 0;
}

function log(str){
    today = yyyy.toString()+mm.toString()+dd.toString();

	fs.appendFileSync('./log/bitfinex_text' + today + '.txt', str+'\n', 'utf-8');
}

//공통적인 option들을 만드는 함수
function make_option(uri, body){
    const nonce = Date.now().toString();
	body.request = uri;
	body.nonce	 = nonce;

	const payload_tmp = new Buffer(JSON.stringify(body)).toString('base64');
	
	const signature_tmp = crypto
  	.createHmac('sha384', dpdlvldkdlzl.dpdlvldkdlzltlzmflt)
  	.update(payload_tmp)
  	.digest('hex');
	
	const options_tmp = {
		method: 'post',	
		headers: {
			'X-BFX-APIKEY': dpdlvldkdlzl.dpdlvldkdlzl,
			'X-BFX-PAYLOAD': payload_tmp,
			'X-BFX-SIGNATURE': signature_tmp
	  	},
		body: JSON.stringify(body)
	};
	
	return options_tmp;
}

//현재 잔액정보를 제공하는 함수
async function getBalanceInfo(){
	const balance_uri = '/v1/balances';
	const balance_completeURI = baseUri + balance_uri;

	let available_usd = 0;
	
	const balance_body = {
		  request: balance_uri,
	};

	const balance_options = make_option(balance_uri, balance_body);
	
	await fetch(balance_completeURI, balance_options)
	.then(res => res.json())
	.then(res => {
        console.log('getBalanceInfo', res);

        available_usd = res //배열 1번은 USD정보
	});

	return available_usd;
}

//FundingBook에 Offer하는 함수
async function newOfferFunding(usd, avgRate){
	const newOffer_uri = '/v1/offer/new';
	const newOffer_completeURI = baseUri + newOffer_uri;
	
	const newOffer_data = {
	  currency: 'USD',
	  amount: usd.toString(),
	  rate: avgRate.toString(),
	  period: 2,
	  direction: 'lend'
	};

	const newOffer_body = {
	   currency: newOffer_data.currency,
	   amount: newOffer_data.amount,
	   rate: newOffer_data.rate,
	   period: newOffer_data.period,
	   direction: newOffer_data.direction,
	};

	const newOffer_options = make_option(newOffer_uri, newOffer_body);

	await fetch(newOffer_completeURI, newOffer_options)
	.then(res => res.json())
	.then(res => {
        console.log('new offer', res);

        log("offer Info : ");
		log(JSON.stringify(res, null, 2));
		log('offer OK');
/*
        sendTelegram("ok Offer after cancel ! " +
            "Rate : " + avgRate/(365*100) +
            "USD : " + usd);
            */
		sendTelegram(
			JSON.stringify(res, null, 2)
		)
	})
	.catch(err => {
		log(err);
	});
}

async function getActiveOfferList(){
	const activeOfferList_uri = '/v1/offers';
	let activeOfferList = [];
	const activeOfferList_completeURI = baseUri + activeOfferList_uri;

	const activeOfferList_body = {
	};
	
	const activeOfferList_options = make_option(activeOfferList_uri, activeOfferList_body);

    await fetch(activeOfferList_completeURI, activeOfferList_options)
	.then(res => res.json())
	.then(res => {
        console.log('getMarketAvgRate', res);
        activeOfferList = res;
	})
	.catch(err => {
		console.log(err);
	});

	return activeOfferList;
}

//FundingBook에 게시했던 Offer를 취소하는 함수
async function offerCancel(offer_id){
	const offerCancel_uri = '/v1/offer/cancel';
	const offerCancel_completeURI = baseUri + offerCancel_uri;

	const offerCancel_body = {
	   offer_id : parseInt(offer_id),
	};
	
	const offerCancel_options = make_option(offerCancel_uri, offerCancel_body);
	
	await fetch(offerCancel_completeURI, offerCancel_options)
	.then(res => res.json())
	.then(res => {
		if(res.indexOf("message") === -1){
            //실패
			log('[Cancel ERROR]');
            sendTelegram('Cancel failed !' + offer_id
			+ "\n" +
			JSON.stringify(res, null, 2)
            );
		} else {
            console.log('cancel', res);
            log('cancel');
            log(res.id + " cancel OK");
            sendTelegram('Cancel Ok !' + offer_id);
        }
    })
	.catch(err => {
		log('[Cancel ERROR]');
		log(err);
        sendTelegram('Cancel failed !' + offer_id
		+ "\n " + JSON.stringify(err, null, 2)
		);
	});
}

//현재 Funding한 정보 출력(많이 쓰이진 않을듯)
async function getActiveCreditsInfo(order_id){
	const activeCredits_uri = '/v1/credits';
	
	const activeCredits_body = {
	};
	
	const activeCredits_options = make_option(activeCredits_uri, activeCredits_body);
	
	request.post(
	  activeCredits_options,
	  function(error, response, body) {
		log('activeCredits_response:', JSON.stringify(response));
	  }
	);
}

async function fundingBook(){

    const funding_uri = '/v2/book/fUSD/P3';

	const fundingBook_completeURI = baseUri + funding_uri;

    /*
		RATE,
		PERIOD,
		COUNT,
		AMOUNT > 0인경우를 봐야함
	*/

	let maxRate = 0;
	let tmp = null;
    // request
    await fetch(fundingBook_completeURI, {})
	.then(res => res.json())
	.then(res => {
		console.log(res);
		tmp = res;
		/*
		for(var i = 0; i < res.length; i++){
			if(res[i][3] > 0 && res[i][1] === 2) {
				if(maxRate < res[i][0]) {
                    maxRate = res[i][0];
                }
			}
		}
		*/
    });

    return tmp;
}

async function getMarketAvgRate(available_usd){

	let marketAvgRateUri = '/v2/calc/trade/avg';

	const marketAvgRate_completeURI = baseUri + marketAvgRateUri;

	let a ={};

    const marketAvgRate_options = {
        method: 'post',
        url : marketAvgRate_completeURI,
		headers : {},
        body : {}//JSON.stringify(qs),
    };

    // request
    await fetch(marketAvgRate_completeURI+'?symbol=fUSD&amount='+available_usd + '&period=2', marketAvgRate_options)
	.then(res => res.json())
	.then(res => {
		console.log('getMarketAvgRate', res);
		a = res;
		// return res;
	});

    return a;
}

async function main() {

    const startTime = Date.now().toString();
    log('------------------------------------------------');
	log('START : ' + startTime);
/*
    let available_usd = await getBalanceInfo(); // 내 계좌 정보

    let avgRate = await fundingBook(); // 거래완료된 10건정도 뽑아서 제일높은 이율

    let activeOfferList = await getActiveOfferList(); // 상태가 active 거래정보

    let marketAvgRate = await getMarketAvgRate(available_usd); //설정한 금액의 거래되고있는 시장의 평균 이율정보
*/
    bot.on(/\/Help/, async msg => {
        msg.reply.text(
			"/balance : 현재 계좌 잔고 정보 출력 getBalanceInfo\n" +
            "/offer p1 p2 : 거래 체결 신청 p1(금액) p2(이율) newOfferFunding\n" +
            "/activelist :  active상태 거래 정보 출력 getActiveOfferList\n" +
            "/cancel p1 : active상태의 거래 취소 p1(offer id) offerCancel\n" +
            "/recenttrx :  최근 거래내역의 정보 fundingBook//최근 거래 10건의 정보 내역 \n" +
            "/avgrate p1 : 입력한금액의 평균 이율 p1(금액) getMarketAvgRate //현재가격 평균 이율\n"
        );
    });

    bot.on(/\/Balance/, async msg => {
        let balanceInfo = await getBalanceInfo(); // 내 계좌 정보

        msg.reply.text(
        	"USD : " + balanceInfo[1].available + //1번은 USD
        	"\n" +
			"XRP : " + balanceInfo[2].available //1번은 USD
		);
    });

    bot.on(/^\/Offer (.+)$/, async (msg, props) => {
        const text = props.match[1];
        // await newOfferFunding(avgRate_discount, available_usd);
        let offerInfo = text.split(" ");

        await newOfferFunding(offerInfo[0], offerInfo[1]*(365));

        // return bot.sendMessage(msg.from.id, text, { replyToMessage: msg.message_id });
    });

    bot.on(/\/Activelist/, async msg => {
		activeOfferList = await getActiveOfferList();
		let tmp = JSON.stringify(activeOfferList, null, 2);
        msg.reply.text(
            tmp
        );
    });

    bot.on(/\/Cancel (.+)$/, async (msg, props) => {
        const offerId = props.match[1];
    	await offerCancel(offerId);
    });

    bot.on(/\/Recenttrx/, async msg => {
        let avgRate = await fundingBook();

        msg.reply.text(
            'recent trx : ' + JSON.stringify(avgRate, null, 2)
        );
    });

    bot.on(/\/Avgrate (.+)$/, async (msg, props) => {
		const avgInfo = props.match[1];

		let avgRate = await getMarketAvgRate(avgInfo[0]);

        msg.reply.text(
            'avgRate : ' + avgRate
        );
    });

    bot.start();

    log('END   : ' + Date.now().toString());
    log('------------------------------------------------');

	return 0;
}

main();
