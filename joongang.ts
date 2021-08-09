import axios from "axios";
import * as fs from "fs";
import * as cheerio from "cheerio";

class JoongangNewsCrawler {
  public constructor() {}

  public async crawlArticles(day: number) {
    const categories = ["politics", "money", "society", "world"];

    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - day);
    dateLimit.setHours(0, 0, 0, 0);

    const result = [];

    for (const category of categories) {
      let isDone = false;
      for (let i = 1; !isDone; ++i) {
        const articleUrls = await this.crawlArticleUrls(
          `https://news.joins.com/${category}?page=${i}`
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

    const list = $("#content > div.list_basic.list_sectionhome > ul");
    const count = list.children().length;

    for (let i = 1; i <= count; ++i) {
      const obj = {};
      obj["link"] = list.find(`li:nth-child(${i}) > h2 > a`).attr("href");
      obj["date"] = new Date(
        list.find(`li:nth-child(${i}) > span.byline`).text()
      );

      result.push(obj);
    }

    return result;
  }

  private async getArticle(url: string) {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);

    const result = {};

    result["press"] = "joongang";
    result["url"] = url;
    result["headline"] = $("#article_title").text().trim();
    result["subtitle"] = $(".ab_subtitle").text().trim();
    result["createdAt"] = $(
      "#body > div.article_head > div.clearfx > div.byline > em:nth-child(2)"
    )
      .text()
      .trim();
    result["modifiedAt"] = $(
      "#body > div.article_head > div.clearfx > div.byline > em:nth-child(3)"
    )
      .text()
      .trim();
    result["image"] = $(".ab_photo.photo_center > .image > img")[0]?.attribs?.src || '';
    
    const [reporterName, mail] = $(".ab_byline")?.text()?.split(" ")?.filter((el) => el !== "기자");
    result["reporterName"] = reporterName
    result["mail"] = mail;
    
    ["#ja_read_tracker", "#criteo_network", ".ab_subtitle"].forEach((el) => $(el).remove());

    result["paragraphs"] = $("#article_body")
      .html()
      ?.split("<br>")
      ?.map((el) => {
        return el.replaceAll("\n", "").replaceAll("&nbsp;", '').trim();
      })
      ?.filter((el) => el !== "&nbsp;")
      ?.filter((el) => el !== "");

    return result;
  }
}

new JoongangNewsCrawler().crawlArticles(1).then((articles) => {
  fs.writeFileSync("joongang.json", JSON.stringify(articles, null, 2));
});
