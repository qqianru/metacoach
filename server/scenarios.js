// server/scenarios.js - 家长 app 落地页的 10 个 gallery cards
// 每张卡片对应一个 case_index.md 里的案例。点击后会用 openingMessage 启动对话。

const SCENARIOS = [
  {
    id: 'tongtong_quanban_yilun',
    caseRef: '彤彤',
    subjectTag: '人际过敏',
    parentState: '孩子说全班都在议论他，你越解释他越钻牛角尖',
    kidQuote: '"妈，全班都在背后说我，连老师看我一眼都觉得在害我"',
    openingUserMessage: '我女儿初二，最近半个月说全班同学都在背后议论她。我去问班主任，老师说班里很正常。可她不信，说连老师都骗她。今天她从学校回来把自己反锁在房间里。我快崩溃了，是不是要带她去医院看精神科？'
  },
  {
    id: 'haohao_shuxue_hengdun',
    caseRef: '浩浩',
    subjectTag: '学习障碍',
    parentState: '孩子一拿数学卷就装病，怎么打怎么骂都没用',
    kidQuote: '"我头晕、想吐、太困了"——只要一收起数学卷立马活蹦乱跳',
    openingUserMessage: '我儿子初三，一拿出数学卷子就喊头晕、想睡觉，但只要不让他写数学，让他打篮球玩手机就特别有精神。我说他懒，打也打了骂也骂了，他就是不写。这不是装病吗？再这样下去中考完蛋。'
  },
  {
    id: 'xiaoyaC_wanmei_mojing',
    caseRef: '小雅 C',
    subjectTag: '完美主义',
    parentState: '孩子作业写到凌晨，结果大考反而空白',
    kidQuote: `"我得再写一遍，刚才那个'的'字写歪了"`,
    openingUserMessage: '我女儿初三，写作业能写到凌晨。一道数学题她能抠一个小时，字写歪了整页撕掉重写。可大考她脑子反而一片空白，平时会做的全做不出来。老师说她"低灵感"。我急死了，怎么让她快点？'
  },
  {
    id: 'wangpeng_baibanlan',
    caseRef: '王鹏',
    subjectTag: '摆烂泛化',
    parentState: '孩子一件事没做好，就觉得整个人废了',
    kidQuote: '"算了，我什么都学不会，我不上了"',
    openingUserMessage: '我儿子初二，上周体育 800 米差两秒没及格，他从那天开始就不一样了。第二天数学课他跟我说"我也学不好数学了"，第三天背英语单词他说"我也背不下来"。今天直接喊"算了我摆烂"。一次小事就让他对什么都没信心了，怎么办？'
  },
  {
    id: 'xiaolei_xiaomenkou',
    caseRef: '小磊',
    subjectTag: '拒学躯体化',
    parentState: '孩子一到校门口就肚子疼，医院查不出毛病',
    kidQuote: '"妈妈我真的肚子疼，我不是骗你的"',
    openingUserMessage: '我儿子初二，被班主任批评一次以后就不一样了。开始是怕那位老师的课，后来一到学校门口就肚子疼、恶心。我带他去医院做了所有检查，医生说他装病。但他疼得脸都白了，怎么会是装的？现在他死活不去学校。'
  },
  {
    id: 'xiaoyu_shentongbianmotou',
    caseRef: '小雨',
    subjectTag: '性格急转',
    parentState: '原本的"神童"突然变成在家骂人的小霸王',
    kidQuote: '"你别管我！你就是害人精！等我大了让你们好看！"',
    openingUserMessage: '我女儿初二，小学跳级，一直是全班前五。这学期突然两个月不去学校了，一见英语书就烦、说想吐，骂我是"害人精"，扬言"以后要让我们好看"。之前医院说她"精神分裂症状"。我不知道她还是不是我那个聪明的女儿了。'
  },
  {
    id: 'haoyu_xuexiaoguai_zaijiazha',
    caseRef: '浩宇',
    subjectTag: '亲子关系',
    parentState: '老师天天夸他乖，回家一开口就吵架',
    kidQuote: '"你烦不烦！我没事！"——任何问候都被翻译成"逼问"',
    openingUserMessage: '我儿子初一，在学校老师天天夸他懂事，可一回到家，只要我一开口，哪怕只是问一句"作业多不多"，他就像被踩了尾巴一样吼我"你烦不烦"！我们现在基本不说话，一说话就吵架。我是不是很失败的妈妈？'
  },
  {
    id: 'haoran_yuanshengjiating',
    caseRef: '浩然',
    subjectTag: '伪心理学',
    parentState: '孩子看了短视频后，把所有问题甩锅给"原生家庭"',
    kidQuote: '"我现在这样都怪你！你是原生家庭罪人！我得了抑郁症治不好了！"',
    openingUserMessage: '我儿子初二，前阵子不知道看了什么网上心理学短视频，回来天天跟我吵架，说他现在心胸狭隘、爱计较，都是因为我小时候管他太严，给我扣"原生家庭罪人"帽子。他还说自己得了抑郁症治不好了。我看了好几个短视频，越看越觉得是我的错，我把孩子毁了。'
  },
  {
    id: 'linfeifei_jiatinghuyi',
    caseRef: '林菲菲',
    subjectTag: '家庭沟通',
    parentState: '一谈学习就摔门，家庭会议必吵架',
    kidQuote: '"你们根本不懂我！别管我！"——然后摔门离场',
    openingUserMessage: '我女儿初三，最近我们想跟她好好聊聊学习的安排，结果一开口她就说我们"根本不懂"，摔门进卧室。我们还发现她偷偷买了一个"潜能开发课程"，几千块。说轻了说重了都不行。家里现在跟战场一样。'
  },
  {
    id: 'zhangbaoshan_aishenru',
    caseRef: '张宝山',
    subjectTag: '关心被嫌',
    parentState: '你为他熬汤端水，结果换来一句"你别打扰我"',
    kidQuote: '"我不喝！别总进来打断我！"——然后一摆手碗摔了',
    openingUserMessage: '我儿子初三，连着熬夜复习，我心疼他，每天晚上十点准时端一碗热腾腾的燕窝进房间。前天他正卡在一道几何题上，被我一搅和思路全断了，他烦躁地一摆手碗就摔了。我起早贪黑熬汤，他还嫌我打断他！我就这么不会爱孩子吗？'
  }
];

function getAllScenarios() {
  return SCENARIOS;
}

function getScenarioById(id) {
  return SCENARIOS.find(s => s.id === id) || null;
}

module.exports = {
  getAllScenarios,
  getScenarioById,
  SCENARIOS
};
