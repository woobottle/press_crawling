import axios from "axios";
import * as fs from "fs";
import * as cheerio from "cheerio";
import v from 'voca';

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
    // 
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
    const response = await axios.get("https://news.joins.com/article/24128121");
    const $ = cheerio.load(response.data);
    const emailRegex = /[0-9a-zA-Z]([-_.]?[0-9a-zA-Z])*@[0-9a-zA-Z]([-_.]?[0-9a-zA-Z])*.[a-zA-Z]{2,3}$/g;
    const reporterRegex = /\S* 기자$/g;
    const result = {};

    result["press"] = "joongang";
    result["url"] = url;
    result["headline"] = $("#article_title").text().trim();
    result["subtitle"] = $(".ab_subtitle").text().trim().replaceAll('\n', '');
    result["createdAt"] = $("#body > div.article_head > div.clearfx > div.byline > em:nth-child(2)").text().trim();
    result["modifiedAt"] = $("#body > div.article_head > div.clearfx > div.byline > em:nth-child(3)").text().trim();
    result["image"] = $(".ab_photo.photo_center > .image > img")[0]?.attribs?.src || '';
    const [reporterName, mail] = $(".ab_byline")?.text()?.split(" ")?.filter((el) => el !== "기자");
    result["reporterName"] = reporterName
    result["mail"] = mail;

    [
      "#ja_read_tracker",
      "#criteo_network",
      ".ab_subtitle",
      ".caption",
      ".ab_byline",
    ].forEach((el) => $(el).remove());
    const temp = v.stripTags($("#article_body").html(), ['b', 'img', 'br'], 'br')
    const paragraphs = temp
      .replaceAll("<b>", "")
      .replaceAll("</b>", "")
      .trim()
      .replaceAll("&nbsp;", "");
    result["paragraphs"] = paragraphs.split("<br>")
      .map((el) => el.trim())
      .filter((el) => el !== "")
      .map((el) => {
        if(el.indexOf('data-src')) {
          el = el.match(/<img[^>]*?data-src=(["\'])?((?:.(?!\1|>))*.?)/)[2] || '';
        }
        return el;
      })
      .filter((el) => el !== '');
    
    // ["#ja_read_tracker", "#criteo_network", ".ab_subtitle"].forEach((el) => $(el).remove());

    // result["paragraphs"] = $("#article_body")[0]
    //   ?.children.filter((el) => el.type === "text")
    //   ?.map((el) => (el as any).data.trim())
    //   ?.filter((el) => el !== "");

    
    // const b = $("#article_body")[0].children.filter(
    //   (el) =>
    //     el.type === "text" ||
    //     (el.type === "tag" && ((el as any).name === "b" || (el as any).name === "br"))
    // );

    console.log(result);
    return result;
  }
}

new JoongangNewsCrawler().crawlArticles(1).then((articles) => {
  fs.writeFileSync("joongang.json", JSON.stringify(articles, null, 2));
});
