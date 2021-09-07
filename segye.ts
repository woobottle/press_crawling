import axios from "axios";
import * as fs from "fs";
import * as cheerio from "cheerio";
import v from "voca";
import moment from 'moment';
class SegyeNewsCrawler {
  public constructor() {}

  public async crawlArticles(day: number) {
    const politics = [
      [
        '정치',
        `https://www.segye.com/boxTemplate/news/box/newsList.do?dataPath=&dataId=0101010000000&listSize=15&naviSize=10&page={{page}}&dataType=slist`,
      ],
    ]; // 정치
    const society = [
      [
        '사회',
        `https://segye.com/boxTemplate/society/box/newsList.do?dataPath=&dataId=0101080000000&listSize=15&naviSize=10&page={{page}}&dataType=slist`,
      ],
    ]; // 사회
    const world = [
      [
        '국제',
        'https://www.segye.com/boxTemplate/newsList/box/newsList.do?dataPath=0101040000000&dataId=0101040000000&listSize=10&naviSize=10&page={{page}}&dataType=list',
      ],
    ]; // 국제
    const economies = [
      [
        '경제',
        `https://www.segye.com/boxTemplate/newsList/box/newsList.do?dataPath=0101030100000&dataId=0101030100000&listSize=10&naviSize=10&page={{page}}&dataType=list`,
      ],
      [
        '경제',
        `https://www.segye.com/boxTemplate/newsList/box/newsList.do?dataPath=0101030300000&dataId=0101030300000&listSize=10&naviSize=10&page={{page}}&dataType=list`,
      ],
      [
        '경제',
        `https://www.segye.com/boxTemplate/newsList/box/newsList.do?dataPath=0101030700000&dataId=0101030700000&listSize=10&naviSize=10&page={{page}}&dataType=list`,
      ],
    ]; // 경제(일반, 금융*증권, 부동산*건설)

    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - day);
    dateLimit.setHours(0, 0, 0, 0);

    const result = [];
    for (const [name, category] of [
      ...politics,
      ...world,
      ...society,
      ...economies,
    ]) {
      let isDone = false;
      for (let i = 0; !isDone; ++i) {
        const articleUrls = await this.crawlArticleUrls(
          category.replace('{{page}}', `${i}`),
        );

        for (const { link, date } of articleUrls) {
          if (
            date.getMonth() === dateLimit.getMonth() &&
            date.getDate() === dateLimit.getDate()
          ) {
            isDone = true;
            break;
          }

          result.push(await this.getArticle(link, name));
        }
      }
    }

    return result;
  }

  private async crawlArticleUrls(url: string) {
    const result = [];

    const response = await axios.get(url);
    const $ = cheerio.load(response.data);

    const list = $('ul.listBox');
    const children = list[0].children.filter((el) => el.type === 'tag');

    for (const child of children) {
      const obj = {} as any;
      obj.link = (child as any).children.filter(
        (el) => el.name === 'a',
      )[0].attribs.href;
      obj.date = new Date(
        (child as any).children.filter(
          (el) => el.name === 'small',
        )[0].children[0].data,
      );
      result.push(obj);
    }

    return result;
  }

  private async getArticle(link: string, categoryName: string) {
    const postNumber = link
      .replace('http://www.segye.com/newsView/', '')
      .replace('/newsView/', '');
    const year = postNumber.slice(0, 4);
    const month = postNumber.slice(4, 6);
    const day = postNumber.slice(6, 8);
    const url = `https://www.segye.com/content/html/${year}/${month}/${day}/${postNumber}.json`;
    const result = {} as any;

    try {
      const response = await axios.get(url);
      const postData = response.data;
      const {
        title,
        subTitle,
        dateCreated,
        dateLastModified,
        createdBy,
        createdUserEmail,
        fileContent,
        titleImageUrl,
      } = postData;

      result.press_name = '세계일보';
      result.url = url;
      result.title = title || '';
      result.sub_title = subTitle || '';
      result.post_made_at = dateCreated
        ? moment(`${new Date(dateCreated)}`).format('입력 YYYY-MM-DD HH:mm')
        : '';
      result.post_updated_at = dateLastModified
        ? moment(`${new Date(dateLastModified)}`).format(
            '수정 YYYY-MM-DD HH:mm',
          )
        : '';
      result.reporter_name = createdBy;
      result.reporter_mail = createdUserEmail;
      result.category_name = categoryName;

      const regex = /src\s*=\s*"([^"]+)"/;
      const temp = v.stripTags(
        fileContent,
        ['figcaption', 'b', 'img', 'br'],
        '<br>',
      );
      if (titleImageUrl) {
        result.image = `https://img.segye.com/${titleImageUrl}`;
      }
      result.paragraphs = temp
        .split('<br>')
        .map((el) => el.trim())
        .map((el) => el.replaceAll('&nbsp;', ''))
        .filter((el) => el !== '')
        .map((el) => {
          if (el.indexOf('src')) {
            const src = regex.exec(el);
            if (src) {
              el = `https://img.segye.com${src[1]}`;
            }
          }
          return el;
        });
    } catch (error) {
      console.log(link);
      console.log(error);
    }

    return result;
  }
}

new SegyeNewsCrawler().crawlArticles(1).then((articles) => {
  fs.writeFileSync("segye.json", JSON.stringify(articles, null, 2));
});
