import axios from "axios";
import * as fs from "fs";
import * as cheerio from "cheerio";

class HaniNewsCrawler {
  public constructor() {}

  public async crawlArticles(day: number) {
    const categories = ["society", "economy", "politics", "international"];
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - day);
    dateLimit.setHours(0, 0, 0, 0);

    const result = [];

    for (const category of categories) {
      let isDone = false;
      for (let i = 1; !isDone; ++i) {
        const articleUrls = await this.crawlArticleUrls(
          `https://www.hani.co.kr/arti/${category}/list${i}.html`
        );

        for (let { link, date } of articleUrls) {
          if (date < dateLimit) {
            isDone = true;
            break;
          }

          result.push(await this.getArticle(link));
        }
      }
    }

    return result;
  }

  private async crawlArticleUrls(url: string) {
    const result = [];

    const response = await axios.get(url);
    const $ = cheerio.load(response.data);

    const list = $("#section-left-scroll-in > div.section-list-area");
    const count = list.children().length;

    for (let i = 2; i <= count; ++i) {
      const obj = {};

      obj["link"] = list
        .find(`div:nth-child(${i}) > div > h4 > a`)
        .prop("href");
      obj["date"] = new Date(
        list.find(`div:nth-child(${i}) > div > p > span`).text()
      );

      obj["link"] = new URL(obj["link"], url).href;

      result.push(obj);
    }

    return result;
  }

  private async getArticle(url: string) {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);

    const result = {};

    result["press"] = "hankyoreh";
    result["url"] = url;
    result["headline"] = $("#article_view_headline > h4 > span").text().trim();
    result["subtitle"] = $(
      "#a-left-scroll-in > div.article-text > div > div.subtitle"
    )
      .text()
      .trim();
    result["createdAt"] = $(
      "#article_view_headline > p.date-time > span:nth-child(1)"
    )
      .text()
      .trim();
    result["modifiedAt"] = $(
      "#article_view_headline > p.date-time > span:nth-child(2)"
    )
      .text()
      .trim();
    result["image"] = `https:${
      $(
        "#a-left-scroll-in > div.article-text > div > div.text > .image-area > .imageC > .image > img"
      )[0]?.attribs?.src
    }`;
    result["reporterName"] = $("meta[property='dd:author']")[0]?.attribs?.content?.split(",")[0];
    result["mail"] = $(
      "#a-left-scroll-in > div.article-text > div > div.text > a[href^='mailto']"
    ).text();

    [
      "#ad_tag",
      "script",
      "#ADOP_V_yFm9GAZdAl",
      "#news-box",
      "#news-box2",
      "#news-box3",
      "#news-box4",
    ].forEach((el) => $(el).remove());
    
    result["paragraphs"] = $("#a-left-scroll-in > div.article-text > div > div.text")
      .html()
      .trim()
      .split('<p align="justify"></p>')
      .map((el) => {
        return el.trim().replaceAll("\n", "").replaceAll("\t", "");
      }).filter((el) => el !== '');
    return result;
  }
}

new HaniNewsCrawler().crawlArticles(1).then((articles) => {
  fs.writeFileSync("hankyoreh.json", JSON.stringify(articles, null, 2));
});
