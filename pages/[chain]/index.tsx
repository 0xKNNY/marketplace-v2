import {
  GetStaticPaths,
  GetStaticProps,
  InferGetStaticPropsType,
  NextPage,
} from 'next'
import { Text, Flex, Box } from 'components/primitives'
import Layout from 'components/Layout'
import { paths } from '@reservoir0x/reservoir-sdk'
import { useContext, useEffect, useMemo, useState } from 'react'
import { Footer } from 'components/home/Footer'
import { useMediaQuery } from 'react-responsive'
import { useMarketplaceChain, useMounted } from 'hooks'
import supportedChains from 'utils/chains'
import { Head } from 'components/Head'
import { ChainContext } from 'context/ChainContextProvider'
import { Dropdown, DropdownMenuItem } from 'components/primitives/Dropdown'
import { faChevronDown } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useRouter } from 'next/router'
import { ChainStats } from 'components/home/ChainStats'
import useTopSellingCollections from 'hooks/useTopSellingCollections'
import { CollectionTopSellingTable } from 'components/home/CollectionTopSellingTable'
import { FillTypeToggle } from 'components/home/FillTypeToggle'
import { TimeFilterToggle } from 'components/home/TimeFilterToggle'
import fetcher from 'utils/fetcher'

type Props = InferGetStaticPropsType<typeof getStaticProps>

const IndexPage: NextPage<Props> = ({ ssr }) => {
  const isSSR = typeof window === 'undefined'
  const isMounted = useMounted()
  const isSmallDevice = useMediaQuery({ maxWidth: 905 }) && isMounted
  const marketplaceChain = useMarketplaceChain()
  const router = useRouter()
  const [fillType, setFillType] = useState<'mint' | 'sale' | 'any'>('sale')
  const [minutesFilter, setMinutesFilter] = useState<number>(1440)

  const { chain, switchCurrentChain } = useContext(ChainContext)

  const startTime = useMemo(() => {
    const now = new Date()
    const timestamp = Math.floor(now.getTime() / 1000)
    return timestamp - minutesFilter * 60
  }, [minutesFilter])

  const {
    data: topSellingCollectionsData,
    collections: collectionsData,
    isValidating,
  } = useTopSellingCollections(
    {
      startTime,
      fillType,
      limit: 20,
      includeRecentSales: true,
    },
    {
      revalidateOnMount: true,
      refreshInterval: 300000,
      fallbackData: [
        ssr.topSellingCollections[marketplaceChain.id].collections,
      ],
    },
    chain?.id
  )

  const [topSellingCollections, setTopSellingCollections] = useState<
    ReturnType<typeof useTopSellingCollections>['data']
  >(ssr.topSellingCollections[marketplaceChain.id])
  const [collections, setCollections] =
    useState<ReturnType<typeof useTopSellingCollections>['collections']>(
      collectionsData
    )

  useEffect(() => {
    if (!isValidating) {
      setTopSellingCollections(topSellingCollectionsData)
      setCollections(collectionsData)
    }
  }, [isValidating])

  return (
    <Layout>
      <Head />
      <Box
        css={{
          p: 24,
          height: '100%',
          '@bp800': {
            p: '$6',
          },
        }}
      >
        
        
        
        <Footer />
      </Box>
    </Layout>
  )
}

export const getStaticPaths: GetStaticPaths = async () => {
  return {
    paths: [],
    fallback: 'blocking',
  }
}

type TopSellingCollectionsSchema =
  paths['/collections/top-selling/v1']['get']['responses']['200']['schema']

type ChainTopSellingCollections = Record<string, TopSellingCollectionsSchema>

type CollectionSchema =
  paths['/collections/v5']['get']['responses']['200']['schema']
type ChainCollections = Record<string, CollectionSchema>

export const getStaticProps: GetStaticProps<{
  ssr: {
    topSellingCollections: ChainTopSellingCollections
  }
}> = async () => {
  const now = new Date()
  const timestamp = Math.floor(now.getTime() / 1000)
  const startTime = timestamp - 1440 * 60 // 24hrs ago

  let topSellingCollectionsQuery: paths['/collections/top-selling/v1']['get']['parameters']['query'] =
    {
      startTime: startTime,
      fillType: 'sale',
      limit: 20,
      includeRecentSales: true,
    }

  const promises: ReturnType<typeof fetcher>[] = []
  supportedChains.forEach((chain) => {
    const query = { ...topSellingCollectionsQuery }

    promises.push(
      fetcher(`${chain.reservoirBaseUrl}/collections/top-selling/v1`, query, {
        headers: {
          'x-api-key': chain.apiKey || '',
        },
      })
    )
  })
  const responses = await Promise.allSettled(promises)
  const topSellingCollections: ChainTopSellingCollections = {}
  responses.forEach((response, i) => {
    if (response.status === 'fulfilled') {
      topSellingCollections[supportedChains[i].id] = response.value.data
    }
  })

  return {
    props: { ssr: { topSellingCollections } },
    revalidate: 5,
  }
}

export default IndexPage
