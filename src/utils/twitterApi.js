const axios = require("axios");

// Utility delay function
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Random delay between 5-8 seconds
function randomDelay() {
  return 5000 + Math.floor(Math.random() * 3000);
}

async function getAllRetweeters(tweetId) {
  const apiKey = process.env.TWITTER_API_KEY;
  let cursor = "";
  let hasNextPage = true;

  const usernames = new Set();

  while (hasNextPage) {
    const response = await axios.get(
      "https://api.twitterapi.io/twitter/tweet/retweeters",
      {
        headers: { "X-API-Key": apiKey },
        params: { tweetId, cursor },
      }
    );

    if (response.data.status !== "success") {
      console.log(response.data);
    }

    const users = response.data.users || [];
    for (const user of users) {
      if (user.userName) usernames.add(user.userName.toLowerCase());
    }

    hasNextPage = response.data.has_next_page;
    cursor = response.data.next_cursor || "";

    // Safety break
    if (!cursor) break;

    // Wait 5-8 seconds before next request
    await sleep(randomDelay());
  }

  return usernames;
}

async function getAllReplies(tweetId) {
  const apiKey = process.env.TWITTER_API_KEY;
  let cursor = "";
  let hasNextPage = true;

  const usernames = new Set();

  while (hasNextPage) {
    const response = await axios.get(
      "https://api.twitterapi.io/twitter/tweet/replies",
      {
        headers: { "X-API-Key": apiKey },
        params: { tweetId, cursor },
      }
    );

    console.log(response.data);
    if (response.data.status !== "success") {
      throw new Error(response);
    }

    const replies = response.data.tweets || [];
    for (const reply of replies) {
      console.log(reply);
      const username = reply?.author?.userName;
      console.log(username);
      if (username) usernames.add(username.toLowerCase());
    }

    hasNextPage = response.data.has_next_page;
    cursor = response.data.next_cursor || "";
    if (!cursor) break;

    await sleep(randomDelay());
  }

  return usernames;
}

async function getAllQuotes(tweetId) {
  const apiKey = process.env.TWITTER_API_KEY;
  let cursor = "";
  let hasNextPage = true;

  const usernames = new Set();

  while (hasNextPage) {
    const response = await axios.get(
      "https://api.twitterapi.io/twitter/tweet/quotes",
      {
        headers: { "X-API-Key": apiKey },
        params: { tweetId, includeReplies: true, cursor },
      }
    );

    if (response.data.status !== "success") {
      throw new Error(response.data.message || "Failed to fetch quotes");
    }

    const tweets = response.data.tweets || [];
    for (const tweet of tweets) {
      const username = tweet?.author?.userName;
      if (username) usernames.add(username.toLowerCase());
    }

    hasNextPage = response.data.has_next_page;
    cursor = response.data.next_cursor || "";
    if (!cursor) break;

    await sleep(randomDelay());
  }

  return usernames;
}

module.exports = { getAllRetweeters, getAllReplies, getAllQuotes };
