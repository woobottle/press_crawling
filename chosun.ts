import axios from "axios";
import * as fs from "fs";
import * as cheerio from "cheerio";
import v from 'voca';

class ChosunCrawler {
  public constructor() {}

  public async crawlArticles(day: number) {
    const categories = [['정치', 'politics'], ['사회', 'national'], ['경제', 'economy'], ['국제', 'international']];

    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - day);
    dateLimit.setHours(0, 0, 0, 0);

    const result = [];
    for (const [categoryName, category] of categories) {
      let isDone = false;
      for (let i = 0; !isDone; ++i) {
        const articleUrls = await this.crawlArticleUrls(
          `https://www.chosun.com/pf/api/v3/content/fetch/story-feed?query={"excludeContentTypes":"video","excludeSections":"","includeContentTypes":"story","includeSections":"/${category}","offset":${
            i * 10
          },"size":10}&filter={content_elements{_id,canonical_url,display_date,count,next, promo_items{basic{url, resizedUrls{16x9_lg,16x9_md,16x9_sm},subtype,type,url,width}}}&d=654&_website=chosun`
        );

        for (let { link, date, image } of articleUrls) {
          if (date < dateLimit) {
            isDone = true;
            break;
          }

          result.push(await this.getArticle(link, image, categoryName));
        }
      }
    }
    return result;
  }

  private async crawlArticleUrls(url: string) {
    const result = [];
    const response = await axios.get(url).then((resp) => resp.data);
    const list = response.content_elements;
    
    list.forEach((el, index) => {
      const { canonical_url: link, display_date: date, promo_items } = el;
      const obj = {};

      obj["link"] = `https://www.chosun.com${link}`;
      obj["date"] = new Date(date);
      obj["image"] = promo_items?.basic?.resizedUrls["16x9_lg"] || '';
      result.push(obj);
    })
    return result;
  }

  private async getArticle(url: string, image: string, categoryName: string) {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    const emailRegex =
      /[0-9a-zA-Z]([-_.]?[0-9a-zA-Z])*@[0-9a-zA-Z]([-_.]?[0-9a-zA-Z])*.[a-zA-Z]{2,3}$/g;
    const result = {};

    const metadata = $("#fusion-metadata")[0].children[0] // [0].children[0].data;
    const metadataScripts = (metadata as any).data
    const lastIndex = metadataScripts.indexOf(";Fusion.globalContentConfig=");
    const metadataContents = metadataScripts
      .substring(metadataScripts.indexOf("Fusion.globalContent"), lastIndex)
      .replace("Fusion.globalContent=", "")
      .replace(";Fusion.spa=false;Fusion.spaEnabled=false;", "");
    const articleJson = JSON.parse(metadataContents);
    const { headlines, subheadlines, display_date, created_date, last_updated_date, first_publish_date, credits, content_elements } = articleJson;

    result["press"] = '조선일보';
    result["url"] = url;
    result["headline"] = v.stripTags(headlines.basic) || '';
    result["subtitle"] = v.stripTags(subheadlines.basic) || '';
    result["createdAt"] = display_date || created_date;
    result["modifiedAt"] = last_updated_date || first_publish_date;
    result["image"] = image;
    result["category_name"] = categoryName;

    const reporter = credits.by[0] || '';
    const { original } = reporter.additional_properties || '';
    result["reporterName"] = original?.byline || '';
    result["reporterMail"] = original?.email || ''; 

    const paragraphs = content_elements.map((el) => {
      if(el.type === 'image') {
        return el.resizedUrls.article_lg;
      } else if(el.type === 'raw_html') {
        return '';
      }
      return v.stripTags(el.content);
    })

    result["paragraphs"] = paragraphs.filter((el) => el !== "");
    return result;
  }
}

new ChosunCrawler().crawlArticles(1).then((articles) => {
  fs.writeFileSync("chosun.json", JSON.stringify(articles, null, 2));
});
