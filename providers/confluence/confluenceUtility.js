const axios = require("axios");
const express = require("express");
const app = express();
const nonTechnicalArrayKeyword = require("./../nonTechnicalKeywords");
const dotenv = require("dotenv");
dotenv.config();

// Confluence API credentials
const confluenceBaseUrl = process.env.CONFLUENCE_URL;
const username = process.env.CONFLUENCE_USERNAME;
const password = process.env.CONFLUENCE_PASSWORD;

const pageId = process.env.CONFLUENCE_PAGE_ID;

const auth = {
  username: username,
  password: password,
};

async function getPageContent(pageId) {
  try {
    const response = await axios.get(
      `${confluenceBaseUrl}/rest/api/content/${pageId}?expand=body.storage,title`,
      {
        auth,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    return {
      title: response.data.title,
      body: response.data.body.storage.value,
    };
  } catch (error) {
    console.error("Error fetching page content:", error.message);
    throw error;
  }
}

app.get("/allContent", async (req, res) => {
  try {
    const pageContent = await getPageContent(pageId);
    res.status(200).json({
      status: "success",
      title: pageContent.title,
      body: pageContent.body,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to retrieve content." });
  }
});

async function searchQuery(keyword) {
  try {
    const pageContent = await getPageContent(pageId);

    const keywordFoundInTitle = pageContent.title
      .toLowerCase()
      .includes(keyword);
    const keywordFoundInBody = pageContent.body.toLowerCase().includes(keyword);

    let articleContent = "";
    let articleFound = false;

    const boldTextRegex = /<strong>|<b>(.*?)<\/b>/gi;

    if (keywordFoundInBody) {
      const bodyLines = pageContent.body.split("\n");
      let foundBoldText = false;
      let tempArticleContent = "";

      for (const line of bodyLines) {
        if (line.match(boldTextRegex)) {
          if (foundBoldText) {
            break;
          }
          foundBoldText = true;
        }

        if (foundBoldText) {
          tempArticleContent += line + "\n";
        }
      }

      if (tempArticleContent) {
        const paragraphs = tempArticleContent.split("<p />");

        const paragraphWithKeyword = paragraphs.find((paragraph) =>
          paragraph.toLowerCase().includes(keyword)
        );

        if (paragraphWithKeyword) {
          articleContent = paragraphWithKeyword;
          articleFound = true;
        }
      }
    }

    return {
      keywordFoundInTitle,
      keywordFoundInBody,
      keywordFound: keywordFoundInTitle || keywordFoundInBody, // Flag indicating keyword was found
      articleFound,
      articleContent,
    };
  } catch (error) {
    console.error("Error searching keyword:", error.message);
    throw error;
  }
}

function findTechnicalKeywords(question) {
  const keywords = question.toLowerCase().split(" ");
  const foundKeywords = [];

  for (const keyword of keywords) {
    if (!nonTechnicalArrayKeyword.includes(keyword)) {
      foundKeywords.push(keyword);
    }
  }

  return foundKeywords;
}
app.post("/question", async (req, res) => {
  const { question } = req.body;

  if (!question) {
    return res.status(400).json({ error: "Question is required" });
  }

  const foundKeywords = findTechnicalKeywords(question);
  console.log("foundKeywords", foundKeywords);

  if (foundKeywords.length > 0) {
    const results = [];

    for (const keyword of foundKeywords) {
      const { articleFound, articleContent } = await searchQuery(keyword);
      results.push({
        keyword,
        articleFound,
        articleContent,
      });
    }
    return res.json({ results });
  } else {
    return res.json({
      message: "No technical keywords found in the question.",
    });
  }
});

module.exports = app;
