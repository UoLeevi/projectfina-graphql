node {
    stage('Preparation') {
        git 'https://github.com/UoLeevi/projectfina-graphql.git'
    }
    stage('Build') {
        sh 'npm run build'
    }
    stage('Restart') {
        sh 'sudo systemctl restart projectfina-graphql.service'
    }
}
