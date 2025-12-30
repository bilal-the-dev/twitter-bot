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
  const baseUrl = "https://api.tweetapi.com/tw-v2/tweet/retweets";

  const usernames = new Set();

  let cursor = null;
  let lastCursor = null;
  let hasNextPage = true;

  while (hasNextPage) {
    try {
      const params = { tweetId };
      if (cursor) params.cursor = cursor;

      const response = await axios.get(baseUrl, {
        headers: {
          "X-API-Key": apiKey,
        },
        params,
      });

      const users = response.data?.data ?? [];
      const nextCursor = response.data?.pagination?.nextCursor ?? null;
      console.log(users.length);
      // Add users
      for (const user of users) {
        if (user.username) usernames.add(user.username.toLowerCase());
      }

      // Pagination stop conditions
      if (
        users.length === 0 ||
        !nextCursor ||
        nextCursor === cursor ||
        nextCursor === lastCursor
      ) {
        hasNextPage = false;
      } else {
        lastCursor = cursor;
        cursor = nextCursor;
        await sleep(randomDelay());
      }
    } catch (err) {
      console.error(
        `[TwitterAPI] Failed fetching retweeters for tweet ${tweetId}:`,
        err.response?.data || err.message
      );
      break;
    }
  }

  return usernames;
}

async function getAllReplies(tweetId) {
  const apiKey = process.env.TWITTER_API_KEY;
  const baseUrl = "https://api.tweetapi.com/tw-v2/tweet/details";

  const usernames = new Set();

  let cursor = null;
  let lastCursor = null;
  let hasNextPage = true;

  while (hasNextPage) {
    try {
      const params = { tweetId };
      if (cursor) params.cursor = cursor;

      const response = await axios.get(baseUrl, {
        headers: {
          "X-API-Key": apiKey,
        },
        params,
      });

      const replies = response.data?.data?.replies || [];
      const nextCursor = response.data?.pagination?.nextCursor;
      console.log(replies.length);
      // ✅ stop if no replies
      if (replies.length === 0) {
        break;
      }

      // collect reply authors
      for (const reply of replies) {
        const username = reply?.author?.username;
        if (username) {
          usernames.add(username.toLowerCase());
        }
      }

      // ✅ pagination safety guards
      if (!nextCursor || nextCursor === lastCursor) {
        hasNextPage = false;
      } else {
        lastCursor = cursor;
        cursor = nextCursor;
        await sleep(randomDelay());
      }
    } catch (err) {
      console.error(
        `[TwitterAPI] Failed fetching replies for tweet ${tweetId}:`,
        err.response?.data || err.message
      );
      break;
    }
  }

  return usernames;
}

async function getAllQuotes(tweetId) {
  const apiKey = process.env.TWITTER_API_KEY;
  const baseUrl = "https://api.tweetapi.com/tw-v2/tweet/quotes";

  const usernames = new Set();

  let cursor = null;
  let hasNextPage = true;
  let lastCursor = null; // safety guard

  while (hasNextPage) {
    try {
      const params = { tweetId };
      if (cursor) params.cursor = cursor;

      const response = await axios.get(baseUrl, {
        headers: {
          "X-API-Key": apiKey,
        },
        params,
      });

      const quotes = response.data?.data || [];
      console.log(quotes.length);
      const nextCursor = response.data?.pagination?.nextCursor;

      // ✅ Stop if no results
      if (quotes.length === 0) {
        break;
      }

      // collect usernames
      for (const quote of quotes) {
        const username = quote?.author?.username;

        if (username) {
          usernames.add(username.toLowerCase());
        }
      }

      // ✅ Stop if no cursor or cursor didn’t change
      if (!nextCursor || nextCursor === lastCursor) {
        hasNextPage = false;
      } else {
        lastCursor = cursor;
        cursor = nextCursor;
        await sleep(randomDelay());
      }
    } catch (err) {
      console.error(
        `[TwitterAPI] Failed fetching quotes for tweet ${tweetId}:`,
        err.response?.data || err.message
      );
      break;
    }
  }

  return usernames;
}

module.exports = { getAllRetweeters, getAllReplies, getAllQuotes };
