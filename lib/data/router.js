module.exports = {
  routers: {
    starz: "0x1355A5E85bDE471B9Aa418F869f936446357748B",
    pancake: "0x10ed43c718714eb63d5aa57b78b54704e256024e",
    uniswap: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D"
  },
  currencies: [
    {
      tokens: "USDT_BSC->WBNB",
      router: "pancake",
    },
    {
      tokens: "WBNB->USDT_BSC",
      router: "pancake",
    },

    {
      tokens: "STL_BSC->USDT_TRON",
      router: "starz",
    },
    {
      tokens: "USDT_TRON->STL_BSC",
      router: "starz",
    },

    {
      tokens: "USDT->WETH",
      router: "uniswap",
    },
    {
      tokens: "WETH->USDT",
      router: "uniswap",
    },

    {
      tokens: "STL_BSC->BUSD_BSC",
      router: "starz",
    },
    {
      tokens: "BUSD_BSC->STL_BSC",
      router: "starz",
    },
    {
      tokens: "STL_BSC->WBNB",
      router: "starz",
    },
    {
      tokens: "WBNB->STL_BSC",
      router: "starz",
    },
    {
      tokens: "STYL_ETH->WETH",
      router: "uniswap",
    },
    {
      tokens: "WETH->STYL_ETH",
      router: "uniswap",
    },
    {
      tokens: "BUSD_BSC->WBNB",
      router: "pancake",
    },
    {
      tokens: "WBNB->BUSD_BSC",
      router: "pancake",
    },
  ],
};
