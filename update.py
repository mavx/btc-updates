import requests
import psql

ENDPOINT = {
    'bitx': 'https://api.mybitx.com/api/1/ticker?pair=XBTMYR',
    'bitav': 'https://apiv2.bitcoinaverage.com/indices/global/ticker/BTCUSD',
    'coindesk': 'https://api.coindesk.com/v1/bpi/currentprice/USD.json',
    'poloniex': 'https://poloniex.com/public?command=returnTicker'
}

def batch_call():
    results = {}
    for key in ENDPOINT:
        try:
            r = requests.get(ENDPOINT.get(key), timeout=200)
            print('GET', r.url, r.status_code)
            results[key] = r.json()
        except Exception as e:
            print(str(e))
            pass

    return results


def update_bitx(db, results):
    try:
        db.execute(
            "INSERT INTO bitx VALUES ((NOW()), (%s), (%s))"
            , [results.get('ask'), results.get('bid')]
            , commit=True
        )
    except Exception as e:
        print(str(e))
        db.rollback()

def update_bitav(db, results):
    try:
        db.execute(
            "INSERT INTO bitcoin_average VALUES ((NOW()), (%s), (%s))"
            , [results.get('ask'), results.get('bid')]
            , commit=True
        )
    except Exception as e:
        print(str(e))
        db.rollback()

def update_coindesk(db, results):
    try:
        rate = results.get('bpi', {}).get('USD', {}).get('rate')
        db.execute(
            "INSERT INTO coindesk VALUES ((NOW()), (%s))"
            , [float(rate.replace(',', ''))]
            , commit=True
        )
    except Exception as e:
        print(str(e))
        db.rollback()

def update_poloniex(db, results):
    try:
        rate = results.get('USDT_BTC', {})
        db.execute(
            "INSERT INTO poloniex VALUES ((NOW()), (%s), (%s))"
            , [rate.get('lowestAsk'), rate.get('highestBid')]
            , commit=True
        )
    except Exception as e:
        print(str(e))
        db.rollback()
        

def main():
    db = psql.Connection()
    response = batch_call()
    update_bitx(db, response.get('bitx', {}))
    update_bitav(db, response.get('bitav', {}))
    update_coindesk(db, response.get('coindesk', {}))
    update_poloniex(db, response.get('poloniex', {}))
    db.end()


if __name__ == '__main__':
    main()
