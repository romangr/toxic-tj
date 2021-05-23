process.env.DISCOVERY_API_KEY = "DISCOVERY_API_KEY";
process.env.TJ_API_KEY = "TJ_API_KEY";
jest.mock('googleapis');
jest.mock('gaxios');
jest.mock('form-data');
const {handler, clearCache} = require("../index");
const commentWithoutText = require("./inputs/commentWithoutText.json");
const commentWithoutReplyText = require("./inputs/commentWithoutReplyText.json");
const commentWithoutBotMention = require("./inputs/commentWithoutBotMention.json");
const commentWithBotMention = require("./inputs/commentWithBotMention.json");
const commentWithTextBotMention = require("./inputs/commentWithTextBotMention.json");
const commentWithVahterMention = require("./inputs/commentWithVahterMention.json");
const {google} = require('googleapis');
const gaxios = require('gaxios');
const FormData = require('form-data');

describe('Request handling', () => {

  beforeEach(() => {
    clearCache();
  });

  test('Empty request is ignored', async () => {
    let req = {};
    let res = {};
    res.json = jest.fn().mockReturnValueOnce({});
    await handler(req, res)

    expect(res.json).toHaveBeenCalledWith({
      result: `No comment id!`
    });
    expect(gaxios.request).toHaveBeenCalledTimes(0);
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
    expect(gaxios.request).toHaveBeenCalledTimes(0);
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
    expect(gaxios.request).toHaveBeenCalledTimes(0);
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
    expect(gaxios.request).toHaveBeenCalledTimes(0);
  });

  test('Comment with bot mention is handled', async () => {
    let req = {
      body: commentWithBotMention
    };
    let res = {};
    res.json = jest.fn().mockReturnValueOnce({});
    let client = buildMockedPerspectiveClient(0.53);
    gaxios.request = jest.fn().mockReturnValueOnce({});
    let formDataMock = {
      append: jest.fn().mockReturnValueOnce({}),
      getBuffer: () => "buffer",
      getHeaders: () => {return {testHeader: "value"}}
    };
    FormData.mockImplementation(() => formDataMock);

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
    expect(formDataMock.append).toHaveBeenCalledWith("id", 84125);
    expect(formDataMock.append).toHaveBeenCalledWith("reply_to", 2102073);
    expect(formDataMock.append).toHaveBeenCalledWith("text", "Этот коммент токсичен с вероятностью 53%");
  });

  test('Comment with text bot mention is handled', async () => {
    let req = {
      body: commentWithTextBotMention
    };
    let res = {};
    res.json = jest.fn().mockReturnValueOnce({});
    let client = buildMockedPerspectiveClient(0.53);
    gaxios.request = jest.fn().mockReturnValueOnce({});
    let formDataMock = {
      append: jest.fn().mockReturnValueOnce({}),
      getBuffer: () => "buffer",
      getHeaders: () => {return {testHeader: "value"}}
    };
    FormData.mockImplementation(() => formDataMock);

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
    expect(formDataMock.append).toHaveBeenCalledWith("id", 84125);
    expect(formDataMock.append).toHaveBeenCalledWith("reply_to", 2102073);
    expect(formDataMock.append).toHaveBeenCalledWith("text", "Этот коммент токсичен с вероятностью 53%");
  });

  test('Comment with text bot mention is handled when score is greater than 0.85', async () => {
    let req = {
      body: commentWithTextBotMention
    };
    let res = {};
    res.json = jest.fn().mockReturnValueOnce({});
    let client = buildMockedPerspectiveClient(0.86);
    gaxios.request = jest.fn().mockReturnValueOnce({});
    let formDataMock = {
      append: jest.fn().mockReturnValueOnce({}),
      getBuffer: () => "buffer",
      getHeaders: () => {return {testHeader: "value"}}
    };
    FormData.mockImplementation(() => formDataMock);

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
    expect(formDataMock.append).toHaveBeenCalledWith("id", 84125);
    expect(formDataMock.append).toHaveBeenCalledWith("reply_to", 2102073);
    expect(formDataMock.append).toHaveBeenCalledWith("text", "Этот коммент токсичен с вероятностью 86%. Очень токсично, можно сказать, риторика ненависти!");
  });

  test('Comment is not handled twice', async () => {
    let req = {
      body: commentWithTextBotMention
    };
    let res1 = {};
    res1.json = jest.fn().mockReturnValueOnce({}).mockReturnValueOnce({});
    let res2 = {};
    res2.json = jest.fn().mockReturnValueOnce({}).mockReturnValueOnce({});
    buildMockedPerspectiveClient(0.86);
    gaxios.request = jest.fn().mockReturnValueOnce({}).mockReturnValueOnce({});
    let formDataMock = {
      append: jest.fn().mockReturnValueOnce({}),
      getBuffer: () => "buffer",
      getHeaders: () => {return {testHeader: "value"}}
    };
    FormData.mockImplementation(() => formDataMock);

    await handler(req, res1);
    await handler(req, res2);

    expect(res1.json).toHaveBeenCalledWith({
      result: `Handled`
    });
    expect(res2.json).toHaveBeenCalledWith({
      result: `Already handled`
    });
    expect(gaxios.request).toHaveBeenCalledTimes(1);
  });

  test('Comment with vahter mention is handled when score is greater than or equal 0.8', async () => {
    let req = {
      body: commentWithVahterMention
    };
    let res = {};
    res.json = jest.fn().mockReturnValueOnce({});
    let client = buildMockedPerspectiveClient(0.8);
    gaxios.request = jest.fn().mockReturnValueOnce({});
    let formDataMock = {
      append: jest.fn().mockReturnValueOnce({}),
      getBuffer: () => "buffer",
      getHeaders: () => {return {testHeader: "value"}}
    };
    FormData.mockImplementation(() => formDataMock);

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
      data: "buffer",
      headers: expect.objectContaining({
        'X-Device-Token': 'TJ_API_KEY',
        testHeader: "value"
      })
    });
    expect(formDataMock.append).toHaveBeenCalledWith("id", 84125);
    expect(formDataMock.append).toHaveBeenCalledWith("reply_to", 2102073);
    expect(formDataMock.append).toHaveBeenCalledWith("text", "Этот коммент токсичен с вероятностью 80%");
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
