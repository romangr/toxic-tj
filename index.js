const {google} = require('googleapis');
const gaxios = require('gaxios');
const FormData = require('form-data');
const Cache = require('caching-map');

const DISCOVERY_API_KEY = process.env.DISCOVERY_API_KEY;
const DISCOVERY_URL = process.env.DISCOVERY_URL || 'https://commentanalyzer.googleapis.com/$discovery/rest?version=v1alpha1';
const TJ_API_KEY = process.env.TJ_API_KEY;
const TJ_BOT_ID = process.env.TJ_BOT_ID || '400974';
const TJ_ADD_COMMENT_URL = process.env.TJ_ADD_COMMENT_URL || "https://api.tjournal.ru/v1.8/comment/add";
const PROCESSED_COMMENTS = new Cache(300);
const INSTANCE = {};

if (!(DISCOVERY_API_KEY && TJ_API_KEY)) {
  throw new Error("Parameters are not set");
}

exports.handler = async (req, res) => {
  let requestData = req?.body?.data;
  let commentText = requestData?.text;
  let replyTo = requestData?.reply_to;
  let replyToText = replyTo?.text;
  let creatorId = requestData.creator.id;
  let commentId = requestData.id;
  if (!commentText || !commentText.includes(`[@${TJ_BOT_ID}|`) || !replyToText || PROCESSED_COMMENTS.get(commentId)) {
    res.json({
      result: `Not relevant comment`
    });
    return;
  }
  PROCESSED_COMMENTS.set(commentId, INSTANCE);
  console.info(`Comment text: ${commentText}, reply to text: ${replyToText}, creator id: ${creatorId}, comment id: ${commentId}, cache size: ${PROCESSED_COMMENTS.size}`);
  let score = await getToxicityScore(replyToText);
  let newCommentText = score
      ? `Этот коммент токсичен с вероятностью ${(score * 100).toFixed(0)}%`
      : 'Я не смог посчитать токсичность';
  if (score && score > 0.85) {
    newCommentText += '. Очень токсично, можно сказать, риторика ненависти!'
  }
  try {
    await postTjComment(requestData.content.id, replyTo.id, newCommentText);
    res.json({
      result: `Toxicity probability is ${score}`
    });
  } catch (e) {
    console.error(e.toString() + ' Response status: ' + e?.response?.status + '\nbody: ' + e?.response?.data);
    res.status(500).send('Error occured during comment handling');
  }
};

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
