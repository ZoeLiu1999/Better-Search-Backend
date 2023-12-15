const express = require('express');
const axios = require('axios');
const cors = require('cors');
const OAuthToken = require('./ebay_oauth_token');
const { MongoClient, ServerApiVersion } = require('mongodb');

const app = express();
const port = 8080;

app.use(express.json());
app.use(cors());
const config = require('./config');v

const uri = config.dburi;

// eBay API endpoint and your eBay app credentials
const EBAY_API_ENDPOINT = config.EBAY_API_ENDPOINT;
const EBAY_APP_ID = config.EBAY_APP_ID;

//Google Photo Search credentials
const SEARCH_ID = config.SEARCH_ID;
const SEARCH_KEY = config.SEARCH_KEY;

const client = new MongoClient(uri);



async function main() {
  try {
    await client.connect();
  } catch (e) {
    console.error(e);
  }
}

main().catch(console.error);

app.get('/getWishList', async (req, res) => {
  const collection = client.db('Wish-List').collection('products');
  const data = await collection.find().toArray();
  const newData = data.map((item) => {
    const { _id, ...rest } = item;
    return rest;
  });
  res.json(newData);
});

app.get('/addProduct', async (req, res) => {
  await client
    .db('Wish-List')
    .collection('products')
    .insertOne(req.query, function (err, res) {
      if (err) throw err;
    });
  res.json('success');
});

app.get('/removeProduct', async (req, res) => {
  client
    .db('Wish-List')
    .collection('products')
    .deleteOne(req.query, function (err, res) {
      if (err) throw err;
    });
  res.json('success');
});

app.get('/autocomplete-location', async (req, res) => {
  const { query } = req.query;
  try {
    const response = await axios.get(
      `http://api.geonames.org/postalCodeSearchJSON?postalcode_startsWith=${query}&maxRows=5&username=yanxiaoliu&country=US`
    );
    const suggestions = response.data.postalCodes.map(
      (location) => location.postalCode
    );
    console.log(suggestions);
    res.json(suggestions);
  } catch (error) {
    res.json(null);
  }
});

app.get('/', (req, res) => {
  res.send('Test1');
});

app.get('/search', async (req, res) => {
  const {
    keyword,
    categoryId,
    New,
    Used,
    free_shipping,
    local_pickup,
    distance,
    zipcode,
  } = req.query;

  const searchParams = {
    keywords: keyword,
    buyerPostalCode: zipcode,
  };

  if (categoryId) {
    searchParams['categoryId'] = categoryId;
  }
  let filter_count = 0;

  if (New && Used) {
    searchParams[`itemFilter(0).name`] = 'Condition';
    searchParams[`itemFilter(0).value(0)`] = '1000';
    searchParams[`itemFilter(0).name`] = 'Condition';
    searchParams[`itemFilter(0).value(1)`] = '1000';
    filter_count++;
  } else if (New) {
    searchParams[`itemFilter(0).name`] = 'Condition';
    searchParams[`itemFilter(0).value(0)`] = '1000';
    filter_count++;
  } else if (Used) {
    searchParams[`itemFilter(0).name`] = 'Condition';
    searchParams[`itemFilter(0).value(0)`] = '3000';
    filter_count++;
  }

  if (free_shipping) {
    searchParams[`itemFilter(${filter_count}).name`] = 'FreeShippingOnly';
    searchParams[`itemFilter(${filter_count}).value`] = 'true';
    filter_count++;
  }

  if (local_pickup) {
    searchParams[`itemFilter(${filter_count}).name`] = 'LocalPickupOnly';
    searchParams[`itemFilter(${filter_count}).value`] = 'true';
    filter_count++;
  }

  if (distance) {
    searchParams[`itemFilter(${filter_count}).name`] = 'MaxDistance';
    searchParams[`itemFilter(${filter_count}).value`] = distance;
    filter_count++;
  }
  const requestParams = {
    'OPERATION-NAME': 'findItemsAdvanced',
    'SERVICE-VERSION': '1.0.0',
    'SECURITY-APPNAME': EBAY_APP_ID,
    'RESPONSE-DATA-FORMAT': 'JSON',
    'paginationInput.entriesPerPage': '50',
    'outputSelector(0)': 'SellerInfo',
    'outputSelector(1)': 'StoreInfo',
    ...searchParams,
  };
  console.log(requestParams);
  try {
    const response = await axios.get(EBAY_API_ENDPOINT, {
      params: requestParams,
    });
    if (response.status === 200) {
      const ebayData = response.data;
      const items = ebayData.findItemsAdvancedResponse[0].searchResult[0].item;

      // Function to extract data from each item

      let count = 0;
      const extractItemData = (item) => {
        return {
          id: item.itemId ? item.itemId[0] : 'null',
          title: item.title ? item.title[0] : 'null',
          productURL: item.viewItemURL ? item.viewItemURL[0] : 'null',
          galleryURL: item.galleryURL ? item.galleryURL[0] : 'null',
          postalCode: item.postalCode ? item.postalCode[0] : 'null',
          storeName:
            item.storeInfo && item.storeInfo[0]
              ? item.storeInfo[0].storeName[0]
              : 'null',
          storeURL:
            item.storeInfo && item.storeInfo[0]
              ? item.storeInfo[0].storeURL[0]
              : 'null',
          feedbackScore:
            item.sellerInfo && item.sellerInfo[0]
              ? item.sellerInfo[0].feedbackScore[0]
              : 'null',
          positiveFeedbackPercent:
            item.sellerInfo && item.sellerInfo[0]
              ? item.sellerInfo[0].positiveFeedbackPercent[0]
              : 'null',
          shippingCost:
            item.shippingInfo &&
            item.shippingInfo[0] &&
            item.shippingInfo[0].shippingServiceCost
              ? item.shippingInfo[0].shippingServiceCost[0].__value__
              : 'null',
          shipToLocations:
            item.shippingInfo && item.shippingInfo[0]
              ? item.shippingInfo[0].shipToLocations[0]
              : 'null',
          handlingTime:
            item.shippingInfo && item.shippingInfo[0]
              ? item.shippingInfo[0].handlingTime[0]
              : 'null',
          sellingPrice:
            item.sellingStatus && item.sellingStatus[0]
              ? item.sellingStatus[0].currentPrice[0].__value__
              : 'null',
          returnsAccepted: item.returnsAccepted
            ? item.returnsAccepted[0]
            : 'null',
          conditionId:
            item.condition && item.condition[0]
              ? item.condition[0].conditionId[0]
              : 'null',
          favorite: false,
        };
      };

      const extractedData = items.map(extractItemData);

      res.json(extractedData);
    } else {
      console.error(
        'Failed to retrieve data from eBay:',
        response.status,
        response.statusText
      );
      res.json([]);
    }
  } catch (error) {
    console.error('Error making eBay API request:', error);
    res.json([]);
  }
});

app.get('/get_item_info', async (req, res) => {
  const itemId = req.query.itemId;

  const params = {
    callname: 'GetSingleItem',
    responseencoding: 'JSON',
    appid: EBAY_APP_ID,
    siteid: '0',
    version: '967',
    ItemID: itemId,
    IncludeSelector: 'Description,Details,ItemSpecifics',
  };

  // Configure headers
  const client_id = EBAY_APP_ID;
  const client_secret = 'PRD-d9ea8859f473-56de-4c61-98b4-4bd6';
  const oauth_utility = new OAuthToken(client_id, client_secret);
  const application_token = await oauth_utility.getApplicationToken();

  const headers = {
    'X-EBAY-API-IAF-TOKEN': application_token,
  };

  const url = 'https://open.api.ebay.com/shopping';
  try {
    const response = await axios.get(url, { params, headers });
    if (response.status === 200) {
      const itemData = response.data.Item;
      const formattedData = {
        id: itemData.ItemID ? itemData.ItemID : 'null',
        pictureURL: itemData.PictureURL ? itemData.PictureURL : [],
        feedbackScore:
          itemData.Seller && itemData.Seller.FeedbackScore
            ? String(itemData.Seller.FeedbackScore)
            : 'null',
        positiveFeedbackPercent:
          itemData.Seller && itemData.Seller.PositiveFeedbackPercent
            ? String(itemData.Seller.PositiveFeedbackPercent)
            : 'null',
        nameValueList:
          itemData.ItemSpecifics && itemData.ItemSpecifics.NameValueList
            ? itemData.ItemSpecifics.NameValueList
            : [],
        storeURL:
          itemData.Storefront && itemData.Storefront.StoreURL
            ? itemData.Storefront.StoreURL
            : 'null',
        storeName:
          itemData.Storefront && itemData.Storefront.StoreName
            ? itemData.Storefront.StoreName
            : 'null',
        returnMode:
          itemData.ReturnPolicy && itemData.ReturnPolicy.Refund
            ? itemData.ReturnPolicy.Refund
            : 'null',
        returnsWithin:
          itemData.ReturnPolicy && itemData.ReturnPolicy.ReturnsWithin
            ? itemData.ReturnPolicy.ReturnsWithin
            : 'null',
        returnsAccepted:
          itemData.ReturnPolicy && itemData.ReturnPolicy.ReturnsAccepted
            ? itemData.ReturnPolicy.ReturnsAccepted
            : 'null',
        shippingCostPaidBy:
          itemData.ReturnPolicy && itemData.ReturnPolicy.ShippingCostPaidBy
            ? itemData.ReturnPolicy.ShippingCostPaidBy
            : 'null',
        HandlingTime: itemData.HandlingTime
          ? String(itemData.HandlingTime)
          : 'null',
        globalShipping: itemData.GlobalShipping
          ? itemData.GlobalShipping
          : false,
      };

      // Now, 'formattedData' contains an array of items formatted according to the specified structure
      console.log(formattedData);

      res.json(formattedData);
    } else {
      console.error(
        'Failed to retrieve data from eBay:',
        response.status,
        response.statusText
      );
      res.status(500).json({ error: 'Failed to retrieve data from eBay' });
    }
  } catch (error) {
    console.error('Error making eBay API request:', error);
    res.status(500).json({ error: 'Error making eBay API request' });
  }
});

app.get('/get_item_photo', async (req, res) => {
  const url = 'https://www.googleapis.com/customsearch/v1';
  const itemTitle = req.query.itemTitle;

  const params = {
    q: itemTitle,
    cx: SEARCH_ID,
    imgSize: 'huge',
    num: '8',
    searchType: 'image',
    key: SEARCH_KEY,
  };
  try {
    const response = await axios.get(url, { params });
    if (response.status === 200) {
      const photos = response.data.items;

      const links = photos.map((item) => item.link);

      res.json(links);
    } else {
      console.error(
        'Failed to retrieve data from eBay:',
        response.status,
        response.statusText
      );
      res.json(null);
    }
  } catch (error) {
    console.error('Error making eBay API request:', error);
    res.json(null);
  }
});

app.get('/get_similar', async (req, res) => {
  const url = 'https://svcs.ebay.com/MerchandisingService';
  const itemId = req.query.itemId;

  const params = {
    'OPERATION-NAME': 'getSimilarItems',
    'SERVICE-NAME': 'MerchandisingService',
    'SERVICE-VERSION': '1.1.0',
    'CONSUMER-ID': EBAY_APP_ID,
    'RESPONSE-DATA-FORMAT': 'JSON',
    maxResults: '20',
    itemId: itemId,
  };
  try {
    const response = await axios.get(url, { params });
    if (response.status === 200) {
      const similarProductList =
        response.data.getSimilarItemsResponse.itemRecommendations.item;

      const extractedDataList = similarProductList.map((item) => ({
        id: item.itemId || 'null',
        title: item.title || 'null',
        days: (item.timeLeft.match(/P(\d+)DT/) || [])[1] || 'null',
        img: item.imageURL || 'null',
        price: (item.buyItNowPrice && item.buyItNowPrice.__value__) || 'null',
        shipping: (item.shippingCost && item.shippingCost.__value__) || 'null',
      }));

      res.json(extractedDataList);
    } else {
      console.error(
        'Failed to retrieve data from eBay:',
        response.status,
        response.statusText
      );
      res.json(null);
    }
  } catch (error) {
    console.error('Error making eBay API request:', error);
    res.status(500).json({ error: 'Error making eBay API request' });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
