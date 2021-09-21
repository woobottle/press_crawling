import axios from "axios";
import * as fs from "fs";
import * as cheerio from "cheerio";
import v from 'voca';

class JoongangNewsCrawler {
  public constructor() {}

  public async crawlArticles(day: number) {
    const categories = [["Politics", 185], ["Money", 193], ["Society", 192] , ["World", 208]];

    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - day);
    dateLimit.setHours(0, 0, 0, 0);

    const result = [];

    for (const [category, itemId] of categories) {
      let isDone = false;
      for (let i = 1; !isDone; ++i) {
        const articleUrls = await this.crawlArticleUrls(
          `https://www.joongang.co.kr/_CP/537?category=${category}&pageItemId=${itemId}&page=${i}`,
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
    const list = $("#story_list");
    const count = list.children().length;
    for (let i = 1; i <= count; ++i) {
      const obj = {};
      obj["link"] = list.find(`li:nth-child(${i}) > .card_body > .headline > a`).attr("href");
      obj["date"] = new Date(
        list.find(`li:nth-child(${i}) > .card_body > .meta > p.date`).text()
      );

      result.push(obj);
    }
    return result;
  }

  private async getArticle(url: string) {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    const emailRegex =
      /[0-9a-zA-Z]([-_.]?[0-9a-zA-Z])*@[0-9a-zA-Z]([-_.]?[0-9a-zA-Z])*.[a-zA-Z]{2,3}$/g;
    const reporterRegex = /\S* 기자$/g;
    const result = {};
    result["press"] = "joongang";
    result["url"] = url;
    result["headline"] = $(".article > .article_header > .headline").text().trim().replaceAll("\n", "");
    // 중앙일보 서브타이틀 사라짐
    result["createdAt"] = $(".article > .article_header > .datetime > .time_bx > .date:nth-child(1)").text().trim();
    result["modifiedAt"] = $(".article > .article_header > .datetime > .time_bx > .date:nth-child(2)").text().trim();
    result["image"] = $("meta[property='og:image']")[0]?.attribs?.content || "";
    const [reporterName, mail] = $(".ab_byline")?.text()?.split(" ")?.filter((el) => el !== "기자");
    result["reporterName"] = reporterName;
    result["mail"] = mail;

    [".ad_wrap", ".ab_byline", ".ab_subtitle", ".caption"].forEach((el) =>$(el).remove());
    const temp = v.stripTags($("#article_body").html(),["b", "img", "br"],"<br>");
    const paragraphs = temp
      .replaceAll("<b>", "")
      .replaceAll("</b>", "")
      .trim()
      .replaceAll("&nbsp;", "");
    const regex = /src\s*=\s*"([^"]+)"/;
    result["paragraphs"] = paragraphs
      .split("<br>")
      .map((el) => el.trim())
      .filter((el) => el !== "")
      .map((el) => {
        if (el.indexOf("src")) {
          const src = regex.exec(el);
          if (src) {
            el = src[1];
          }
        }
        return el;
      })
      .filter((el) => el !== "");

    return result;
  }
}

new JoongangNewsCrawler().crawlArticles(1).then((articles) => {
  fs.writeFileSync("joongang.json", JSON.stringify(articles, null, 2));
});
