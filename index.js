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

const handlers = [
  noCommentIdHandler,
  commentAlreadyProcessedHandler,
  rostixCaseHandler,
  serguunCaseHandler,
  generalCaseHandler
]

exports.handler = async (req, res) => {
  res.json({
    result: 'Handled'
  });

  let inputs = prepareInputs(req);

  for (const handler of handlers) {
    let result = await handler(inputs);
    if (result.isHandled) {
      if (result.error) {
        res.status(500).send('Error occured during comment handling');
        return;
      }
      return;
    }
  }
};

exports.clearCache = function () {
  PROCESSED_COMMENTS.clear();
}

function noCommentIdHandler(inputs) {
  if (!inputs.commentId) {
    console.log("No comment id!");
    return {
      isHandled: true,
      message: "No comment id!"
    };
  }
  return {
    isHandled: false
  };
}

function commentAlreadyProcessedHandler(inputs) {
  if (PROCESSED_COMMENTS.get(inputs.commentId)) {
    return {
      isHandled: true,
      message: 'Already handled'
    };
  }
  PROCESSED_COMMENTS.set(inputs.commentId, INSTANCE);
  return {
    isHandled: false
  };
}

async function rostixCaseHandler(inputs) {
  if (weekDayMoscowTime() === 6
      && inputs.requestData?.content?.owner?.id === ROSTISLAVE_ID
      && inputs.commentText
      && isBotExplicitlySummoned(inputs.commentText)
      && inputs.replyTo?.id) {
    console.log("Handling Rostix case");
    await postTjComment(inputs.contentId, inputs.replyTo.id, `Этот коммент токсичен с вероятностью -${getRandomInt(50, 95)}%`);
    return {
      isHandled: true
    };
  }
  return {
    isHandled: false
  };
}

async function serguunCaseHandler(inputs) {
  if (inputs.replyTo?.creator?.id == TJ_BOT_ID
      && inputs.requestData?.creator?.id === SERGUUN_ID
      && inputs.commentText
      && inputs.replyTo?.id) {
    console.log("Handling Serguun case");
    await postTjComment(inputs.contentId, inputs.replyTo.id, '1.7.(3/4) Преследование ботов. Мы знаем, что комфортному общению можно препятствовать преследуя бота, например, одним и тем же вопросом или высказыванием. По жалобе преследуемого мы изучим ситуацию и можем ограничить доступ к TJ.');
    return {
      isHandled: true
    };
  }
  return {
    isHandled: false
  };
}

async function generalCaseHandler(inputs) {
  let {
    commentText,
    replyTo,
    replyToText,
    creatorId,
    commentId,
    contentId
  } = inputs;

  if (!commentText || !replyToText || !isBotSummoned(commentText)) {
    return {
      isHandled: false
    };
  }
  console.info(
      `Comment text: ${commentText}, reply to text: ${replyToText}, creator id: ${creatorId}, comment id: ${commentId}, cache size: ${PROCESSED_COMMENTS.size}`);
  let score = await getToxicityScore(replyToText);
  let newCommentText = prepareNewCommentText(score);
  try {
    if (!isBotExplicitlySummoned(commentText) && isVahterSummoned(commentText) && score < 0.8) {
      return {
        isHandled: true
      };
    }
    await postTjComment(contentId, replyTo.id, newCommentText);
    return {
      isHandled: true
    };
  } catch (e) {
    console.error(
        e.toString() + ' Response status: ' + e?.response?.status + '\nbody: '
        + e?.response?.data);
    return {
      isHandled: true,
      error: true
    };
  }
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
