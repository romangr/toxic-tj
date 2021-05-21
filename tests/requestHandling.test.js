process.env.DISCOVERY_API_KEY = "DISCOVERY_API_KEY";
process.env.TJ_API_KEY = "TJ_API_KEY";
jest.mock('googleapis');
jest.mock('gaxios');
const {handler} = require("../index");
const commentWithoutText = require("./inputs/commentWithoutText.json");
const commentWithoutReplyText = require("./inputs/commentWithoutReplyText.json");
const commentWithoutBotMention = require("./inputs/commentWithoutBotMention.json");
const commentWithBotMention = require("./inputs/commentWithBotMention.json");
const commentWithTextBotMention = require("./inputs/commentWithTextBotMention.json");
const commentWithVahterMention = require("./inputs/commentWithVahterMention.json");
const {google} = require('googleapis');
const gaxios = require('gaxios');

describe('Request handling', () => {

  test('Empty request is ignored', async () => {
    let req = {};
    let res = {};
    res.json = jest.fn().mockReturnValueOnce({});
    await handler(req, res)

    expect(res.json).toHaveBeenCalledWith({
      result: `No comment id!`
    });
  });

  test('Comment without text is ignored', async () => {
    let req = {
      body: commentWithoutText
    };
    let res = {};
    res.json = jest.fn().mockReturnValueOnce({});

    await handler(req, res)

    expect(res.json).toHaveBeenCalledWith({
      result: `Not relevant comment`
    });
  });

  test('Comment without reply text is ignored', async () => {
    let req = {
      body: commentWithoutReplyText
    };
    let res = {};
    res.json = jest.fn().mockReturnValueOnce({});

    await handler(req, res)

    expect(res.json).toHaveBeenCalledWith({
      result: `Not relevant comment`
    });
  });

  test('Comment without bot mention is ignored', async () => {
    let req = {
      body: commentWithoutBotMention
    };
    let res = {};
    res.json = jest.fn().mockReturnValueOnce({});

    await handler(req, res)

    expect(res.json).toHaveBeenCalledWith({
      result: `Not relevant comment`
    });
  });

  test('Comment with bot mention is handled', async () => {
    let req = {
      body: commentWithBotMention
    };
    let res = {};
    res.json = jest.fn().mockReturnValueOnce({});
    let client = buildMockedPerspectiveClient(0.53);
    gaxios.request = jest.fn().mockReturnValueOnce({});

    await handler(req, res)

    expect(res.json).toHaveBeenCalledWith({
      result: `Handled`
    });
    expect(client.comments.analyze).toHaveBeenCalledWith(
        {
          key: "DISCOVERY_API_KEY",
          resource: {
            comment: {
              text: "ReplyToText",
            },
            requestedAttributes: {
              TOXICITY: {},
            },
            languages: ["ru"]
          },
        }
    );
    expect(gaxios.request).toHaveBeenCalledWith({
      url: "https://api.tjournal.ru/v1.8/comment/add",
      method: "POST",
      data: expect.anything(),
      headers: expect.objectContaining({
        'X-Device-Token': 'TJ_API_KEY'
      })
    });
  });

  test('Comment with text bot mention is handled', async () => {
    let req = {
      body: commentWithTextBotMention
    };
    let res = {};
    res.json = jest.fn().mockReturnValueOnce({});
    let client = buildMockedPerspectiveClient(0.53);
    gaxios.request = jest.fn().mockReturnValueOnce({});

    await handler(req, res)

    expect(res.json).toHaveBeenCalledWith({
      result: `Handled`
    });
    expect(client.comments.analyze).toHaveBeenCalledWith(
        {
          key: "DISCOVERY_API_KEY",
          resource: {
            comment: {
              text: "ReplyToText",
            },
            requestedAttributes: {
              TOXICITY: {},
            },
            languages: ["ru"]
          },
        }
    );
    expect(gaxios.request).toHaveBeenCalledWith({
      url: "https://api.tjournal.ru/v1.8/comment/add",
      method: "POST",
      data: expect.anything(),
      headers: expect.objectContaining({
        'X-Device-Token': 'TJ_API_KEY'
      })
    });
  });

  test('Comment with vahter mention is handled when score is greater than or equal 0.8', async () => {
    let req = {
      body: commentWithVahterMention
    };
    let res = {};
    res.json = jest.fn().mockReturnValueOnce({});
    let client = buildMockedPerspectiveClient(0.8);
    gaxios.request = jest.fn().mockReturnValueOnce({});

    await handler(req, res)

    expect(res.json).toHaveBeenCalledWith({
      result: `Handled`
    });
    expect(client.comments.analyze).toHaveBeenCalledWith(
        {
          key: "DISCOVERY_API_KEY",
          resource: {
            comment: {
              text: "ReplyToText",
            },
            requestedAttributes: {
              TOXICITY: {},
            },
            languages: ["ru"]
          },
        }
    );
    expect(gaxios.request).toHaveBeenCalledWith({
      url: "https://api.tjournal.ru/v1.8/comment/add",
      method: "POST",
      data: expect.anything(),
      headers: expect.objectContaining({
        'X-Device-Token': 'TJ_API_KEY'
      })
    });
  });

  test('Comment with vahter mention is ignored when score is less than 0.8', async () => {
    let newComment = JSON.parse(JSON.stringify(commentWithVahterMention));
    newComment.data.id++;
    let req = {
      body: newComment
    };
    let res = {};
    res.json = jest.fn().mockReturnValueOnce({});
    let client = buildMockedPerspectiveClient(0.79);
    gaxios.request = jest.fn().mockReturnValueOnce({});

    await handler(req, res)

    expect(res.json).toHaveBeenCalledWith({
      result: `Handled`
    });
    expect(client.comments.analyze).toHaveBeenCalledWith(
        {
          key: "DISCOVERY_API_KEY",
          resource: {
            comment: {
              text: "ReplyToText",
            },
            requestedAttributes: {
              TOXICITY: {},
            },
            languages: ["ru"]
          },
        }
    );
    expect(gaxios.request).toHaveBeenCalledTimes(0);
  });
});

function buildMockedPerspectiveClient(score) {
  let client = {
    comments: {
      analyze: jest.fn().mockReturnValueOnce({
        data: {
          attributeScores: {
            TOXICITY: {
              summaryScore: {
                value: score
              }
            }
          }
        }
      })
    }
  };
  google.discoverAPI = jest.fn().mockReturnValueOnce(client);
  return client;
}
