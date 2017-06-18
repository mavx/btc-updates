import requests
import psql


def batch_call():
    endpoint = {
        'bitx': 'https://api.mybitx.com/api/1/ticker?pair=XBTMYR',
        'bitav': 'https://apiv2.bitcoinaverage.com/ticker/USD',
        'coindesk': 'https://api.coindesk.com/v1/bpi/currentprice/USD.json',
        'poloniex': 'https://poloniex.com/public?command=returnTicker'
    }

    results = {}
    for key in endpoint:
        r = requests.get(endpoint.get(key))
        results[key] = r.json()
    
    return results


def update_bitx(results):
    db.execute(
        "INSERT INTO bitx VALUES ((NOW()), (%s), (%s))"
        , [results.get('ask'), results.get('bid')]
        , commit=True
    )

def update_bitav(results):
    db.execute(
        "INSERT INTO bitcoin_average VALUES ((NOW()), (%s), (%s))"
        , [results.get('ask'), results.get('bid')]
        , commit=True
    )

def update_coindesk(results):
    rate = results.get('bpi', {}).get('USD', {}).get('rate')
    db.execute(
        "INSERT INTO coindesk VALUES ((NOW()), (%s))"
        , [float(rate.replace(',', ''))]
        , commit=True
    )

def update_poloniex(results):
    rate = results.get('USDT_BTC', {})
    db.execute(
        "INSERT INTO poloniex VALUES ((NOW()), (%s), (%s))"
        , [rate.get('lowestAsk'), rate.get('highestBid')]
        , commit=True
    )


if __name__ == '__main__':
    db = psql.Connection()
    response = batch_call()
    update_bitx(response.get('bitx'))
    update_bitav(response.get('bitav'))
    update_coindesk(response.get('coindesk'))
    update_poloniex(response.get('poloniex'))
    db.end()
