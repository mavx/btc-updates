import requests
import logging
import psql
import os

logging.basicConfig(filename='update_errors.log', level=logging.WARNING)
ENDPOINT = {
    'bitx': 'https://api.mybitx.com/api/1/ticker?pair=XBTMYR',
    'bitav': 'https://apiv2.bitcoinaverage.com/indices/global/ticker/BTCUSD',
    'coindesk': 'https://api.coindesk.com/v1/bpi/currentprice/USD.json',
    'poloniex': 'https://poloniex.com/public?command=returnTicker'
}

# Crypto_updates channel
SLACK_WEBHOOK = os.environ['SLACK_WEBHOOK']

def ping(*msg):
    data = {'text': ' '.join(str(x) for x in msg)}
    try:
        return requests.post(SLACK_WEBHOOK, json=data)
    except Exception as e:
        logging.exception(e)
        pass


def get(endpoint):
    r = requests.get(endpoint, timeout=200)
    logging.info('GET', r.url, r.status_code)
    if r.ok:
        return r.json()


def update_bitx(db):
    try:
        results = get(ENDPOINT['bitx'])
        db.execute(
            "INSERT INTO bitx VALUES ((NOW()), (%s), (%s))"
            , [results['ask'], results['bid']]
            , commit=True
        )
        return True
    except Exception as e:
        logging.exception(e)
        db.rollback()


def update_bitav(db):
    try:
        results = get(ENDPOINT['bitav'])
        db.execute(
            "INSERT INTO bitcoin_average VALUES ((NOW()), (%s), (%s))"
            , [results['ask'], results['bid']]
            , commit=True
        )
        return True
    except Exception as e:
        logging.exception(e)
        db.rollback()


def update_coindesk(db):
    try:
        results = get(ENDPOINT['coindesk'])
        rate = results.get('bpi', {}).get('USD', {})['rate']
        db.execute(
            "INSERT INTO coindesk VALUES ((NOW()), (%s))"
            , [float(rate.replace(',', ''))]
            , commit=True
        )
        return True
    except Exception as e:
        logging.exception(e)
        db.rollback()


def update_poloniex(db):
    try:
        results = get(ENDPOINT['poloniex'])
        rate = results.get('USDT_BTC', {})
        db.execute(
            "INSERT INTO poloniex VALUES ((NOW()), (%s), (%s))"
            , [rate['lowestAsk'], rate['highestBid']]
            , commit=True
        )
        return True
    except Exception as e:
        logging.exception(e)
        db.rollback()


def main():
    db = psql.Connection()
    jobs = [
        update_bitx
#         , update_bitav
        , update_coindesk
        , update_poloniex
    ]

    job_status = {func.__name__: func(db) for func in jobs}
    print(job_status)

    if not all(job_status.values()):
        errors = [job for job in job_status if job_status[job] is not True]
        ping('`ERRORS:`', str(errors))
    db.end()


if __name__ == '__main__':
    main()
