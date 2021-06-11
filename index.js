const {google} = require('googleapis');
const gaxios = require('gaxios');
const FormData = require('form-data');
const Cache = require('caching-map');

const DISCOVERY_API_KEY = process.env.DISCOVERY_API_KEY;
const DISCOVERY_URL = process.env.DISCOVERY_URL
    || 'https://commentanalyzer.googleapis.com/$discovery/rest?version=v1alpha1';
const TJ_API_KEY = process.env.TJ_API_KEY;
const TJ_BOT_ID = process.env.TJ_BOT_ID || '400974';
const TJ_ADD_COMMENT_URL = process.env.TJ_ADD_COMMENT_URL
    || "https://api.tjournal.ru/v1.8/comment/add";
const PROCESSED_COMMENTS = new Cache(50);
const INSTANCE = {};
const VAHTER_ID = 250652;
const ROSTISLAVE_ID = 212551;
const SERGUUN_ID = 99944;
const THREE_HOURS_IN_MILLIS = 3 * 60 * 60 * 1000;
const TOXIC_COMMENTS = [
    '. Очень токсично, можно сказать, риторика ненависти!',
    '. Код красный!'
];

if (!(DISCOVERY_API_KEY && TJ_API_KEY)) {
  throw new Error("Parameters are not set");
}

exports.handler = async (req, res) => {
  let {
    requestData,
    commentText,
    replyTo,
    replyToText,
    creatorId,
    commentId,
    contentId
  } = prepareInputs(req);

  if (!commentId) {
    console.log("No comment id!");
    res.json({
      result: 'No comment id!'
    });
    return;
  }

  if (PROCESSED_COMMENTS.get(commentId)) {
    res.json({
      result: 'Already handled'
    });
    return;
  }
  PROCESSED_COMMENTS.set(commentId, INSTANCE);

  let isHandled = await handleRostislaveCase(replyTo, requestData, commentText, contentId);
  if (isHandled) {
    res.json({
      result: `Handled`
    });
    return;
  }

  isHandled = await handleSerguunCase(replyTo, requestData, commentText, contentId);
  if (isHandled) {
    res.json({
      result: `Handled`
    });
    return;
  }

  if (!commentText || !replyToText || !isBotSummoned(commentText)) {
    res.json({
      result: `Not relevant comment`
    });
    return;
  }
  console.info(
      `Comment text: ${commentText}, reply to text: ${replyToText}, creator id: ${creatorId}, comment id: ${commentId}, cache size: ${PROCESSED_COMMENTS.size}`);
  let score = await getToxicityScore(replyToText);
  let newCommentText = prepareNewCommentText(score);
  try {
    if (!isBotExplicitlySummoned(commentText) && isVahterSummoned(commentText) && score < 0.8) {
      res.json({
        result: `Handled`
      });
      return;
    }
    await postTjComment(contentId, replyTo.id, newCommentText);
    res.json({
      result: `Handled`
    });
  } catch (e) {
    console.error(
        e.toString() + ' Response status: ' + e?.response?.status + '\nbody: '
        + e?.response?.data);
    res.status(500).send('Error occured during comment handling');
  }
};

exports.clearCache = function () {
  PROCESSED_COMMENTS.clear();
}

async function postTjComment(contentId, replyToId, text) {
  const formData = new FormData();
  formData.append('id', contentId);
  formData.append('reply_to', replyToId);
  formData.append('text', text);
  return await gaxios.request({
    url: TJ_ADD_COMMENT_URL,
    method: "POST",
    data: formData.getBuffer(),
    headers: {
      ...formData.getHeaders(),
      'X-Device-Token': `${TJ_API_KEY}`
    }
  });
}

async function getToxicityScore(replyToText) {
  const client = await google.discoverAPI(DISCOVERY_URL);
  const analyzeRequest = {
    comment: {
      text: replyToText,
    },
    requestedAttributes: {
      TOXICITY: {},
    },
    languages: ["ru"]
  };
  const response = await client.comments.analyze(
      {
        key: DISCOVERY_API_KEY,
        resource: analyzeRequest,
      }
  );
  return response.data?.attributeScores?.TOXICITY?.summaryScore?.value;
}

function prepareNewCommentText(score) {
  let newCommentText = score
      ? `Этот коммент токсичен с вероятностью ${(score * 100).toFixed(0)}%`
      : 'Я не смог посчитать токсичность';
  if (score && score > 0.85) {
    let randomInt = getRandomInt(0, TOXIC_COMMENTS.length);
    newCommentText += TOXIC_COMMENTS[randomInt];
  }
  return newCommentText;
}

function isVahterSummoned(commentText) {
  return commentText.includes(`[@${VAHTER_ID}|`);
}

function isBotExplicitlySummoned(commentText) {
  return commentText.includes(`[@${TJ_BOT_ID}|`)
      || commentText.includes('@Токсичный бот');
}

function isBotSummoned(commentText) {
  return isBotExplicitlySummoned(commentText) || isVahterSummoned(commentText);
}

function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min)) + min;
}

function weekDayMoscowTime() {
  return new Date(new Date().getTime() + THREE_HOURS_IN_MILLIS).getDay();
}

async function handleRostislaveCase(replyTo, requestData, commentText, contentId) {
  if (weekDayMoscowTime() === 6
      && requestData?.content?.owner?.id === ROSTISLAVE_ID
      && commentText
      && isBotExplicitlySummoned(commentText)
      && replyTo?.id) {
    console.log("Handling Rostix case");
    await postTjComment(contentId, replyTo.id, `Этот коммент токсичен с вероятностью -${getRandomInt(50, 95)}%`);
    return true;
  }
  return false;
}

async function handleSerguunCase(replyTo, requestData, commentText, contentId) {
  if (replyTo?.creator?.id == TJ_BOT_ID
      && requestData?.creator?.id === SERGUUN_ID
      && commentText
      && replyTo?.id) {
    console.log("Handling Serguun case");
    await postTjComment(contentId, replyTo.id, '1.7.(3/4) Преследование ботов. Мы знаем, что комфортному общению можно препятствовать преследуя бота, например, одним и тем же вопросом или высказыванием. По жалобе преследуемого мы изучим ситуацию и можем ограничить доступ к TJ.');
    return true;
  }
  return false;
}

function prepareInputs(req) {
  let requestData = req?.body?.data;
  let commentText = requestData?.text;
  let replyTo = requestData?.reply_to;
  let replyToText = replyTo?.text;
  let creatorId = requestData?.creator?.id;
  let commentId = requestData?.id;
  let contentId = requestData?.content?.id;
  return {
    requestData,
    commentText,
    replyTo,
    replyToText,
    creatorId,
    commentId,
    contentId
  };
}
